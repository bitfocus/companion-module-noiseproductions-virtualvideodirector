import { Regex } from '@companion-module/base'

export const configFields = [
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
        type: 'number',
        id: 'targetPort',
        label: 'Target Port',
        default: 9000,
        width: 12,
        regex: Regex.PORT
    },
]
    