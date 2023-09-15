import got from 'got'

export function setupActions(instance) {
    instance.setActionDefinitions({
        setChannel: {
            name: "Set Channel",
            description: "Set a new channel number",
            options: [
                {
                    type: 'number',
                    label: 'Channel',
                    id: 'selectedChannel',
                    default: 1
                },
            ],
            callback: async (action, context) => {
                const response = await got.get("http://" + instance.targetIp + ":" + instance.targetPort + "/api/state/setchannel/" + action.options.selectedChannel, null);
            },
        },
        setPower: {
            name: "Set Power",
            description: "Set the power state",
            options: [
                {
                    type: 'dropdown',
                    label: 'Power State',
                    id: 'selectedState',
                    default: "on",
                    choices: [
                        { id: "on", label: "On" },
                        { id: "off", label: "Off" },
                    ],
                },
            ],
            callback: async (action, context) => {
                const response = await got.get("http://" + instance.targetIp + ":" + instance.targetPort + "/api/state/setpower/" + action.options.selectedState, null);
            },
        },
        toggleMuteChannel: {
            name: "Toggle Mute Channel",
            description: "Enables/disables the mute of channel",
            options: [
                {
                    type: 'number',
                    label: 'Channel',
                    id: 'selectedChannel',
                    default: 1
                },
            ],
            callback: async (action, context) => {
                const response = await got.get("http://" + instance.targetIp + ":" + instance.targetPort + "/api/state/togglemutechannel/" + action.options.selectedChannel, null);
            },
        },
        muteChannel: {
            name: "Mute Channel",
            description: "Enables the mute of channel",
            options: [
                {
                    type: 'number',
                    label: 'Channel',
                    id: 'selectedChannel',
                    default: 1
                },
            ],
            callback: async (action, context) => {
                const response = await got.get("http://" + instance.targetIp + ":" + instance.targetPort + "/api/state/mutechannel/" + action.options.selectedChannel, null);
            },
        },
        unmuteChannel: {
            name: "Unmute Channel",
            description: "Disables the mute of channel",
            options: [
                {
                    type: 'number',
                    label: 'Channel',
                    id: 'selectedChannel',
                    default: 1
                },
            ],
            callback: async (action, context) => {
                const response = await got.get("http://" + instance.targetIp + ":" + instance.targetPort + "/api/state/unmutechannel/" + action.options.selectedChannel, null);
            },
        },
    })
}