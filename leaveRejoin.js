function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
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

        const stayTime = randomMs(onlineMinMs, onlineMaxMs)

        logThrottled(`[AFK] Will leave in ${Math.round(stayTime / 1000)} seconds`)

        scheduleNextJump()

        leaveTimer = setTimeout(() => {
            if (stopped) return
            logThrottled('[AFK] Leaving server (timer)')
            if (setNextReconnectDelayMs) {
                setNextReconnectDelayMs(offlineMs)
                logThrottled(`[AFK] Next rejoin forced to ${Math.round(offlineMs / 1000)} seconds`)
            }
            cleanup()
            try {
                bot.quit()
            } catch (e) {
                // ignore if already closed
            }
        }, stayTime)
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
