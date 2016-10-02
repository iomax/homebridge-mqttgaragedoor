# homebridge-mqttgaragedoor
An homebridge plugin that create an HomeKit Garage Door Opener accessory mapped on MQTT topics

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
    
# Release notes
Version 0.0.0
+ Initial draft

# Configuration
Remember to configure the plugin in config.json in your home directory inside the .homebridge directory. Configuration parameters:
+ "accessory": "mqttgaragedoor",
+ "name": "PUT THE NAME OF YOUR SWITCH HERE",
+ "url": "PUT URL OF THE BROKER HERE",
+ "username": "PUT USERNAME OF THE BROKER HERE",
+ "password": "PUT PASSWORD OF THE BROKER HERE",
+ "caption": "PUT THE LABEL OF YOUR SWITCH HERE",
+ "topics": {
 	"statusGet": 	"PUT THE MQTT TOPIC FOR THE GETTING THE STATUS OF YOUR SWITCH HERE",
 	"statusSet": 	"PUT THE MQTT TOPIC FOR THE SETTING THE STATUS OF YOUR SWITCH HERE"
	}

