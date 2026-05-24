function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

function isPromiseLike(value) {
    return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function'
}

function setupLeaveRejoin(bot, options = {}) {
    // Timers
    let leaveTimer = null
    let jumpTimer = null
    let jumpOffTimer = null

    // State
    let stopped = false
    let lastLogAt = 0

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now()
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now
            console.log(msg)
        }
    }

    function cleanup() {
        stopped = true
        if (leaveTimer) clearTimeout(leaveTimer)
        if (jumpTimer) clearTimeout(jumpTimer)
        if (jumpOffTimer) clearTimeout(jumpOffTimer)
        leaveTimer = jumpTimer = jumpOffTimer = null
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return

        bot.setControlState('jump', true)
        jumpOffTimer = setTimeout(() => {
            bot.setControlState('jump', false)
        }, 300)

        // random jump 20s -> 5m
        const nextJump = randomMs(20000, 5 * 60 * 1000)
        jumpTimer = setTimeout(scheduleNextJump, nextJump)
    }

    bot.once('spawn', () => {
        // clear any old timers
        cleanup()
        stopped = false

        const onlineMinMs = Math.max(0, Number(options.onlineMinMs ?? 30 * 60 * 1000))
        const onlineMaxMs = Math.max(onlineMinMs, Number(options.onlineMaxMs ?? 90 * 60 * 1000))
        const offlineMs = Math.max(0, Number(options.offlineMs ?? 3 * 60 * 1000))
        const setNextReconnectDelayMs =
            typeof options.setNextReconnectDelayMs === 'function'
                ? options.setNextReconnectDelayMs
                : null
        const onBeforeLeave =
            typeof options.onBeforeLeave === 'function' ? options.onBeforeLeave : null
        const beforeLeaveTimeoutMs = Math.max(0, Number(options.beforeLeaveTimeoutMs ?? 20000))

        const stayTime = randomMs(onlineMinMs, onlineMaxMs)

        logThrottled(`[AFK] Will leave in ${Math.round(stayTime / 1000)} seconds`)

        if (!options.disableJumps) scheduleNextJump()

        function scheduleLeaveIn(ms) {
            if (leaveTimer) clearTimeout(leaveTimer)
            leaveTimer = setTimeout(attemptLeave, ms)
        }

        async function attemptLeave() {
            if (stopped) return
            logThrottled('[AFK] Leaving server (timer)')
            if (setNextReconnectDelayMs) {
                setNextReconnectDelayMs(offlineMs)
                logThrottled(`[AFK] Next rejoin forced to ${Math.round(offlineMs / 1000)} seconds`)
            }
            // Optional: keep the server alive during the offline window (e.g., by starting a maintenance bot)
            if (onBeforeLeave) {
                try {
                    const result = onBeforeLeave({ offlineMs })
                    if (isPromiseLike(result)) {
                        const timed = new Promise((resolve) =>
                            setTimeout(() => resolve('__timeout__'), beforeLeaveTimeoutMs),
                        )
                        const r = await Promise.race([result, timed])
                        if (r === '__timeout__') {
                            logThrottled(`[AFK] onBeforeLeave timed out after ${Math.round(beforeLeaveTimeoutMs / 1000)}s`)
                        } else if (r === false) {
                            logThrottled('[AFK] onBeforeLeave reported failure; skipping leave to avoid empty server')
                            const retryMs = randomMs(5 * 60 * 1000, 15 * 60 * 1000)
                            logThrottled(`[AFK] Retrying leave in ${Math.round(retryMs / 1000)} seconds`)
                            scheduleLeaveIn(retryMs)
                            return
                        }
                    }
                } catch (e) {
                    // don't block leaving if the hook fails
                }
            }
            cleanup()
            try {
                bot.quit()
            } catch (e) {
                // ignore if already closed
            }
        }

        scheduleLeaveIn(stayTime)
    })

    // When the connection ends for ANY reason, just clean up our timers.
    // Reconnection is handled by index.js — no duplicate reconnect here.
    bot.on('end', () => {
        cleanup()
    })

    bot.on('kicked', () => {
        cleanup()
    })

    bot.on('error', () => {
        cleanup()
    })
}

module.exports = setupLeaveRejoin
