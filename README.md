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
  "name": "PUT THE NAME OF YOUR SWITCH HERE",
  "url": "PUT URL OF THE BROKER HERE",
  "username": "PUT USERNAME OF THE BROKER HERE",
  "password": "PUT PASSWORD OF THE BROKER HERE",
  "caption": "PUT THE LABEL OF YOUR SWITCH HERE",
  "topics": {
              "statusGet": "PUT THE MQTT TOPIC FOR THE GETTING THE STATUS OF YOUR SWITCH HERE",
              "statusSet": "PUT THE MQTT TOPIC FOR THE SETTING THE STATUS OF YOUR SWITCH HERE"
            }
  "doorPollInMs": POLLING TIME (mSec),
  "doorRunInSeconds": DOOR [OPEN|CLOSURE] RUN TIME (Sec),
  "doorFeedBack" : "PUT TYPE OF DOOR FEEDBACK [ OPENED | CLOSED | BOTH | NONE ]"
}
```

# Credit

The original homebridge MQTT plugins work was done by [ilcato](https://github.com/ilcato) in his [homebridge-mqttswitch](https://github.com/ilcato/homebridge-mqttswitch) project.

The original homebridge GarageDoor plugin work was done by [belamonica] (https://github.com/benlamonica) in his [homebridge-rasppi-gpio-garagedoor] (https://github.com/benlamonica/homebridge-rasppi-gpio-garagedoor) project.


