# homebridge-mqttgaragedoor
An homebridge plugin that create an HomeKit Garage Door Opener accessory mapped on MQTT topics

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
    
# Release notes
Version 1.0.0
+ Initial draft

# Configuration
Remember to configure the plugin in config.json in your home directory inside the .homebridge directory. Configuration parameters:
```javascript
{
  "accessory": "mqttgaragedoor",
  "name": "SWITCH NAME",
  "url": "URL OF THE BROKER",
  "username": "USERNAME OF THE BROKER",
  "password": "PASSWORD OF THE BROKER",
  "caption": "SWITCH LABEL",
  "topics": {
		"statusSet":    "MQTT TOPIC FOR THE SETTING THE STATUS"
		"openGet":      "OPTIONAL MQTT TOPIC FOR THE GETTING THE STATUS OF OPEN SWITCH",
		"closedGet":    "OPTIONAL MQTT TOPIC FOR THE GETTING THE STATUS OF CLOSED SWITCH",
		"openValue":    "OPTIONAL VALUE THAT MEANS OPEN (DEFAULT true)"
		"closedValue":  "OPTIONAL VALUE THAT MEANS CLOSED (DEFAULT true)"
            }
  "doorRunInSeconds": "OPEN/CLOSE RUN TIME IN SECONDS",
  "pauseInSeconds" : "IF DEFINED : AUTO CLOSE AFTER [Seconds]"
}
```

# Credit

The original homebridge MQTT plugins work was done by [ilcato](https://github.com/ilcato) in his [homebridge-mqttswitch](https://github.com/ilcato/homebridge-mqttswitch) project.

The original homebridge GarageDoor plugin work was done by [belamonica] (https://github.com/benlamonica) in his [homebridge-rasppi-gpio-garagedoor] (https://github.com/benlamonica/homebridge-rasppi-gpio-garagedoor) project.


