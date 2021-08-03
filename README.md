# homebridge-shar-cocoro

*work in progress* plugin to add HomeKit support to the SHARP Cocoro API that is being used by their series of smart home appliances

Powered by my [cocoro-sdk](https://github.com/dvcrn/cocoro-sdk)

## Features

- Control aircon temperature
- Control aircon windspeed
- Control aircon heating/cooling mode

## Caveats

Currently to authenticate, you need to use something like mitmproxy, charles or proxyman to extract the API token that your app is using.

Hopefully we can eventually make that easier, but currently there is no way around it.

Check out the README of the cocoro-sdk repo with instructions: https://github.com/dvcrn/cocoro-sdk#authentication
