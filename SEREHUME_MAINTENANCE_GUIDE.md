# Serehume & Maintenance Bot Guide

This document explains the new features implemented for automatic server maintenance and Serehume bot handling.

## Overview

The bot system now supports:
1. **Serehume Bot Detection** - Automatically detects when Serehume bot joins
2. **Maintenance Bot Setup** - Spawns Maintenance bot to configure Serehume
3. **ServerHuMef Eating Logic** - Main bots eat golden apples at intervals
4. **Ban Detection** - Tracks when bots get banned and logs appropriately
5. **Continuous Uptime** - Maintains server uptime even when main bot is banned

## Features in Detail

### 1. Serehume Detection & Setup

When the Serehume bot joins the server:

```
Serehume joins → Maintenance bot spawns →
  ├─ Sets Serehume to Creative mode
  ├─ Gives 64 Golden Apples  
  └─ Teleports to Cods location (-7, 64, -17)
```

**Configuration in `settings.json`:**
```json
"serehume-handler": {
  "enabled": true,
  "detect-username": "Serehume",
  "give-item": "golden_apple",
  "give-amount": 64,
  "teleport-x": -7,
  "teleport-y": 64,
  "teleport-z": -17,
  "maintenance-lifetime-seconds": 300
}
```

**Log Output:**
```
[Serehume] Serehume joined the server!
[Serehume] Starting maintenance bot to handle Serehume setup...
[Maintenance] Set Serehume to creative mode
[Maintenance] Gave Serehume 64 golden_apple(s)
[Maintenance] Teleported Serehume to (-7, 64, -17)
```

### 2. ServerHuMef Eating Logic

ServerHuMef and alternate bots (ServerHuMef1, ServerHuMef2, etc.) automatically eat golden apples at configured intervals:

- **Min Delay**: 45 seconds (configurable)
- **Max Delay**: 120 seconds (configurable)
- **Item**: `golden_apple` (configurable)
- **Chance**: 100% by default (configurable)

When a bot eats:
```
[Eating] ServerHuMef ate a golden_apple
```

**Configuration in `settings.json`:**
```json
"creative-eat": {
  "enabled": true,
  "chance": 1,
  "min-delay-seconds": 45,
  "max-delay-seconds": 120,
  "auto-give-if-missing": true,
  "item-name": "golden_apple",
  "ban-time-only": false,
  "ban-time-delay-seconds": 5940,
  "ban-time-jitter-seconds": 300
}
```

### 3. Ban Detection & Handling

When a bot account gets banned:

1. **Detection**: Bot recognizes ban kick message
2. **Logging**: Logs which account was banned
3. **Rotation**: Automatically rotates to next account (ServerHuMef → ServerHuMef1)
4. **Uptime**: Maintenance bot keeps server alive during ban period

**Ban Detection Log:**
```
[Bot] ServerHuMef was banned - will reconnect with alternate account on next cycle
[Ban] Account ServerHuMef has been banned from the server
[Ban] Main bot account was banned - rotation will use alternate accounts
[Ban] Until ban is lifted, maintain server uptime with maintenance bot
```

### 4. Maintenance Bot Behavior

**When Main Bot is Connected:**
- Maintenance bot is stopped
- Main bot handles all operations

**When Main Bot is Banned:**
- Maintenance bot automatically starts
- Keeps server alive and running
- Performs Serehume setup if needed
- Maintains uptime until ban expires

**When Main Bot Disconnects:**
- Maintenance bot activates for offline window
- Duration: `leave-rejoin.offline-seconds` + 60s
- Keeps server from pausing on Aternos

## Configuration

All features are controlled via `settings.json`:

```json
"maintenance-bot": {
  "enabled": true,
  "username": "Maintenance"
}
```

```json
"serehume-handler": {
  "enabled": true,
  "detect-username": "Serehume",
  "give-item": "golden_apple",
  "give-amount": 64,
  "teleport-x": -7,
  "teleport-y": 64,
  "teleport-z": -17,
  "maintenance-lifetime-seconds": 300
}
```

```json
"creative-eat": {
  "enabled": true,
  "chance": 1,
  "min-delay-seconds": 45,
  "max-delay-seconds": 120,
  "auto-give-if-missing": true,
  "item-name": "golden_apple"
}
```

```json
"leave-rejoin": {
  "enabled": true,
  "rotate-usernames": true,
  "offline-seconds": 180
}
```

## How It Works

### Workflow 1: Normal Operation with Serehume

1. Main bot (ServerHuMef) connects and stays online
2. Serehume bot joins the server
3. Bot detects playerJoined event for "serehume"
4. Calls `handleSerehume()` function
5. Starts Maintenance bot with special spawn callback
6. Maintenance bot runs setup commands:
   - `/gamemode creative Serehume`
   - `/give Serehume golden_apple 64`
   - `/tp Serehume -7 64 -17`
7. Main bot eats golden apples at intervals
8. Server stays alive

### Workflow 2: Main Bot Ban Detection

1. Main bot (ServerHuMef) gets banned
2. Server sends kick message with "banned" or "violates"
3. Bot detects ban in kick reason
4. Calls `handleMainBotBanned()` function
5. Records: `bannedAccounts["serverhume"] = true`
6. Logging info: `[Ban] Account ServerHuMef has been banned from the server`
7. Leave/Rejoin cycle rotates to ServerHuMef1
8. Maintenance bot starts to keep server alive
9. When ServerHuMef1 connects, same setup process repeats

### Workflow 3: Offline Window Management

1. Main bot needs to leave/rejoin for session reset
2. Maintenance bot starts with configured lifetime
3. Maintenance bot keeps server from pausing
4. After offline window, main bot reconnects
5. Maintenance bot stops (main bot takes over)

## Troubleshooting

### Serehume Setup Not Running
- Check if `serehume-handler.enabled` is `true` in settings.json
- Check if Maintenance bot username is available (not banned)
- Check logs for `[Maintenance]` entries
- Verify teleport coordinates are valid

### Bot Not Eating Golden Apples
- Check if `creative-eat.enabled` is `true`
- Verify `item-name` matches Minecraft item ID (`golden_apple`)
- Check if bot has golden apples in inventory
- Check for eating logs: `[Eating]`

### Maintenance Bot Not Starting
- Verify `maintenance-bot.enabled` is `true`
- Check if Maintenance account is whitelisted/not banned
- Review connection timeout settings
- Check logs for connection errors

### Ban Not Detected
- Verify kick message contains "banned" or similar
- Check exact ban message from your server
- Update ban detection logic if needed
- Review logs for kick reason details

## Implementation Details

### Key Functions

**`handleSerehume(mainBot)`**
- Triggered when playerJoined event detects "serehume"
- Starts maintenance bot with setup commands
- Configurable via `serehume-handler` settings

**`handleMainBotBanned(bannedUsername)`**
- Called when bot receives ban kick
- Tracks banned account in `bannedAccounts` object
- Logs ban event for debugging

**`setupMaintenanceGift(bot, targetUsername, itemName)`**
- Enhanced to handle Serehume setup
- Executes creative mode and item give commands
- Supports configurable targets and items

**Eating Interval Loop**
- Runs every 45-120 seconds
- Finds `golden_apple` in inventory
- Equips and activates (eats) the item
- Logs eating action

### Event Listeners

**`bot.on("playerJoined", ...)`**
- Detects when any player joins
- Filters for "serehume" username
- Triggers `handleSerehume()` when detected

**`maintenanceBot.on("kicked", ...)`**
- Detects when maintenance bot gets kicked
- Checks for ban messages
- Logs ban detection
- Stops maintenance bot gracefully

## Notes

- Maintenance bot uses offline-mode authentication (same as main bot)
- Serehume setup commands execute with 1.5-3s delays to ensure server processes them
- Eating logic is non-blocking and uses try-catch to gracefully handle missing items
- Ban detection works for most Spigot/Paper servers with standard ban messages
- Leave/Rejoin rotation automatically selects alternate accounts
- Server stays alive during all transitions (main bot disconnect → maintenance → reconnect)

## Future Enhancements

Possible improvements:
- [ ] Track ban expiration time
- [ ] Auto-unban detection when ServerHuMef reconnects successfully
- [ ] Multiple Serehume bot detection
- [ ] Configurable commands for Serehume setup
- [ ] Ban bypass strategies (proxy/VPN detection)
- [ ] Custom eating strategies (healing only when damaged)
- [ ] Serehume completion confirmation (inventory check)
