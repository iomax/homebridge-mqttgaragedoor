# homebridge-mqttgaragedoor
An homebridge plugin that create an HomeKit Garage Door Opener accessory mapped on MQTT topics

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin must be cloned locally (git clone https://github.com/iomax/homebridge-mqttgaragedoor.git ) and should be installed "globally" by typing:

    npm install -g ./homebridge-mqttgaragedoor
   
# Release notes
Version 1.0.1
+ Initial draft

# Configuration
Remember to configure the plugin in config.json in your home directory inside the .homebridge directory. Configuration parameters:
```javascript
{
  "accessory": "mqttgaragedoor",
  "name": "SWITCH NAME",
  "url": "URL OF THE BROKER",
  "send_command": "OPTIONAL SET THE COMMAND TO SEND TO TOPIC EXAMPLE: garage_click",
  "json_path": "OPTIONAL IF MQTT MESSAGE NEEDS JSON PARSING USE THIS OPTION TO SET JSON PATH EXAMPLE: some_path",
  "username": "USERNAME OF THE BROKER",
  "password": "PASSWORD OF THE BROKER",
  "caption": "SWITCH LABEL",
  "topics": {
		"statusSet":    "MQTT TOPIC FOR THE SETTING THE STATUS"
		"openGet":      "OPTIONAL MQTT TOPIC FOR THE GETTING THE STATUS OF OPEN SWITCH",
		"openValue":    "OPTIONAL VALUE THAT MEANS OPEN (DEFAULT true)"
		"closedGet":    "OPTIONAL MQTT TOPIC FOR THE GETTING THE STATUS OF CLOSED SWITCH",
		"closedValue":  "OPTIONAL VALUE THAT MEANS CLOSED (DEFAULT true)"
		"openStatusCmdTopic": "OPTIONAL MQTT TOPIC TO ASK OPEN STATUS",
		"openStatusCmd": "OPTIONAL THE STATUS COMMAND ( DEFAULT "")",
		"closeStatusCmdTopic": "OPTIONAL MQTT TOPIC TO ASK CLOSE STATUS",
		"closeStatusCmd": "OPTIONAL THE STATUS COMMAND (DEFAULT "")"
            }
  "doorRunInSeconds": "OPEN/CLOSE RUN TIME IN SECONDS",
  "pauseInSeconds" : "IF DEFINED : AUTO CLOSE AFTER [Seconds]"
}
```

# Credit

The original homebridge MQTT plugins work was done by [ilcato](https://github.com/ilcato) in his [homebridge-mqttswitch](https://github.com/ilcato/homebridge-mqttswitch) project.

The original homebridge GarageDoor plugin work was done by [belamonica] (https://github.com/benlamonica) in his [homebridge-rasppi-gpio-garagedoor] (https://github.com/benlamonica/homebridge-rasppi-gpio-garagedoor) project.
JSON support in mqtt message was added by [MrBalonio] (https://github.com/mrbalonio)
