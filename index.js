import { InstanceBase, runEntrypoint, InstanceStatus, combineRgb } from '@companion-module/base'
import WebSocket from 'ws'
import { upgradeScripts } from './upgrade.js'
import { Regex } from '@companion-module/base'

class WebsocketInstance extends InstanceBase {
	isInitialized = false

	async init(config) {
		this.config = config
		this.config.apiToken = "";

		this.initWebSocket()
		this.isInitialized = true

		this.isMuted = false;
		this.inMeeting = false;
		this.isCameraOn = false;
		this.isHandRaised = false;
		this.isBackgroundBlurred = false;

		this.initActions()
		this.initFeedbacks()
	}

	async destroy() {
		this.isInitialized = false
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}
		if (this.ws) {
			this.ws.close(1000)
			delete this.ws
		}
	}

	async configUpdated(config) {
		this.config = config
		this.initWebSocket()
	}

	maybeReconnect() {
		if (this.isInitialized && this.config.reconnect) {
			if (this.reconnect_timer) {
				clearTimeout(this.reconnect_timer)
			}
			this.reconnect_timer = setTimeout(() => {
				this.initWebSocket()
			}, 5000)
		}
	}

	initWebSocket() {
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}

		const url = "ws://" + this.config.targetIp + ":5899"
		if (!url || !this.config.targetIp) {
			this.updateStatus(InstanceStatus.BadConfig, `IP is missing`)
			return
		}

		this.updateStatus(InstanceStatus.Connecting)

		if (this.ws) {
			this.ws.close(1000)
			delete this.ws
		}
		this.ws = new WebSocket(url)

		this.ws.on('open', () => {
			this.updateStatus(InstanceStatus.Ok);
			console.log("Api Tokebn: " + this.config.apiToken);
			this.ws.send(
				JSON.stringify({
					type: "auth",
					payload: {
					  identifier: "de.bitfocus.companion",
					  version: "1.0.0",
					  name: "Bitfocus Companion Module",
					  description:
						"Companion module to send Hotkeys to TeamSpeak",
					  content: {
						apiKey: this.config.apiToken,
					  },
					},
				  })
			);
			// this.ws.send('{"apiVersion":"1.0.0","service":"query-meeting-state","action":"query-meeting-state","manufacturer":"Elgato","device":"StreamDeck","timestamp":1675341655453}');
		})
		this.ws.on('close', (code) => {
			if (code == 1006) {
				this.updateStatus(InstanceStatus.Disconnected, `Invalid API token or Teamspeak not running`)
			}
			else {
				this.updateStatus(InstanceStatus.Disconnected, `Connection closed with code ${code}`)
			}
			this.maybeReconnect()
		})

		this.ws.on('message', this.messageReceivedFromWebSocket.bind(this))

		this.ws.on('error', (data) => {
			if (data == "Error: Unexpected server response: 403") {
				this.updateStatus(InstanceStatus.Disconnected, 'Invalid API token or Teamspeak not running')
			}
			else {
				this.log('error', `WebSocket error: ${data}`)
			}
		})
	}

	messageReceivedFromWebSocket(data) {
		let msgValue = null
		try {
			msgValue = JSON.parse(data)
		} catch (e) {
			msgValue = data
		}
		if(msgValue.type == "auth") {
			if(msgValue.payload.apiKey) {
				const apiKey = msgValue.payload.apiKey;
				this.config.apiToken = apiKey;
				console.log(this.config)
			}
		}
		else {
			console.log(msgValue);
			if(msgValue.type == "clientSelfPropertyUpdated") {
				if(msgValue.payload.flag == "inputMuted") {
					this.inputMuted = msgValue.payload.newValue;
				}
				else if(msgValue.payload.flag == "outputMuted") {
					this.outputMuted = msgValue.payload.newValue;
				}
				else if(msgValue.payload.flag == "away") {
					this.afk = msgValue.payload.newValue;
				}
				else if(msgValue.payload.flag == "flagTalking") {
					this.talking = msgValue.payload.newValue;
				}
				
			}
			else if(msgValue.type == "clientMoved") {
				this.currentChannelId = msgValue.payload.newChannelId;
			}
			this.checkFeedbacks();
		}

	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					"An API token is needed for this module to be able to control the Teams instance - follow this URL to generate an API token and copy it to the field below: <br> <a href='https://support.microsoft.com/en-us/office/connect-to-third-party-devices-in-microsoft-teams-aabca9f2-47bb-407f-9f9b-81a104a883d6' target='_blank'>Generate API token</a>",
			},
			{
				type: 'textinput',
				id: 'targetIp',
				label: 'Target IP address',
				tooltip: 'For localhost use 127.0.0.1 (loopback IP)',
				default: '127.0.0.1',
				width: 12,
				regex: Regex.IP
			},
			{
				type: 'textinput',
				id: 'apiToken',
				label: 'MS Teams API Token',
				width: 12,
			},
			{
				type: 'checkbox',
				id: 'reconnect',
				label: 'Reconnect',
				tooltip: 'Reconnect on WebSocket error (after 5 secs)',
				width: 6,
				default: true,
			}
		]
	}

	initFeedbacks() {
		this.setFeedbackDefinitions({
			isMuted: {
				type: 'boolean',
				name: 'Is muted',
				description: 'True when the microphone is muted, false when it is not.',
				options: [
					{
						type: 'checkbox',
						label: 'Invert',
						id: 'invertFeedback',
						default: false
					}
				],
				callback: (feedback, context) => {
					if (feedback.options.invertFeedback) return !this.inputMuted;
					return this.inputMuted;
				}
			},
			outputMuted: {
				type: 'boolean',
				name: 'Output muted',
				description: 'True when the output is muted, false when it is not.',
				options: [
					{
						type: 'checkbox',
						label: 'Invert',
						id: 'invertFeedback',
						default: false
					}
				],
				callback: (feedback, context) => {
					if (feedback.options.invertFeedback) return !this.outputMuted;
					return this.outputMuted;
				}
			},
			talking: {
				type: 'boolean',
				name: 'Talking',
				description: 'True when the user is currently talking, false when he is not.',
				options: [
					{
						type: 'checkbox',
						label: 'Invert',
						id: 'invertFeedback',
						default: false
					}
				],
				callback: (feedback, context) => {
					if (feedback.options.invertFeedback) return !this.talking;
					return this.talking;
				}
			},
			afk: {
				type: 'boolean',
				name: 'AFK',
				description: 'True when the user is currently afk, false when he is not.',
				options: [
					{
						type: 'checkbox',
						label: 'Invert',
						id: 'invertFeedback',
						default: false
					}
				],
				callback: (feedback, context) => {
					if (feedback.options.invertFeedback) return !this.afk;
					return this.afk;
				}
			},
			channelInformation: {
				type: 'advanced',
				name: 'Channel information',
				description: 'Display channel id / label',
				options: [
					{
						type: 'dropdown',
						label: 'Display',
						id: 'displayOptions',
						default: 0,
						choices: [
							{ id: 0, label: "ID" },
							{ id: 1, label: "Label" },
							{ id: 2, label: "ID & Label" },
						],
					}
				],
				callback: (feedback, context) => {
					if(feedback.options.displayOptions == 0) return { text: this.currentChannelId};
					else if(feedback.options.displayOptions == 1) return { text: this.currentChannelLabel};
					else if(feedback.options.displayOptions == 2) return { text: this.currentChannelId + ": " + this.currentChannelLabel};
				}
			},

		})
	}

	initActions() {
		this.setActionDefinitions({
			pushToTalkUnmute: {
				name: "Push To Talk Unmute",
				description: "Enable the microphone",
				options: [],
				callback: async (action, context) => {
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "pushtotalk", state: false },
						  })
					);
				},
			},
			pushToTalkMute: {
				name: "Push To Talk Mute",
				description: "Disable the microphone",
				options: [],
				callback: async (action, context) => {
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "pushtotalk", state: true },
						  })
					);
				},
			},
			muteMicrophone: {
				name: "Mute the microphone",
				description: "Disable the microphone",
				options: [],
				callback: async (action, context) => {
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "mute", state: true },
						  })
					);
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "mute", state: false },
						  })
					);
					
				},
			},
			unmuteMicrophone: {
				name: "Unmute the microphone",
				description: "Enable the microphone",
				options: [],
				callback: async (action, context) => {
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "unmute", state: true },
						  })
					);
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "unmute", state: false },
						  })
					);
				},
			},
			muteSpeaker: {
				name: "Mute the speaker",
				description: "Disable the speaker",
				options: [],
				callback: async (action, context) => {
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "speakerMute", state: true },
						  })
					);
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "speakerMute", state: false },
						  })
					);
				},
			},
			unmuteSpeaker: {
				name: "Unmute the speaker",
				description: "Enable the speaker",
				options: [],
				callback: async (action, context) => {
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "speakerUnmute", state: true },
						  })
					);
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "speakerUnmute", state: false },
						  })
					);
				},
			},
			enableAfk: {
				name: "Enable AFK",
				description: "Enable AFK",
				options: [],
				callback: async (action, context) => {
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "enableAFK", state: true },
						  })
					);
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "enableAFK", state: false },
						  })
					);
				},
			},
			disableAFK: {
				name: "Disable AFK",
				description: "Disable AFK",
				options: [],
				callback: async (action, context) => {
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "disableAFK", state: true },
						  })
					);
					this.ws.send(
						JSON.stringify({
							type: "buttonPress",
							payload: { button: "disableAFK", state: false },
						  })
					);
				},
			},
		})
	}
}

runEntrypoint(WebsocketInstance, upgradeScripts)
