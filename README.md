# Deobfuscator
Tested on twitch.tv [p.js](https://k.twitchcdn.net/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/p.js) 

![preview](https://dexv.online/content/cdn/buytYqspRcgF.png)

Usage:
```bash
node index.js input.js output.js
```

## How It Works

We parse the arrays and the decoding function related to it, and the we parse the shuffle function to shuffle the array. Then we just traverse all call expressions that have two arguments, first one an int and the second one an string, and we replace the string with the decoded string.

### Key Features

- **String Decryption**: Decrypts encrypted strings using a custom RC4-based algorithm??
- **Function Shuffling**: Shuffles the array by basically brute forcing or something like that


# Credits
* **DEXV** - *Shit head (retarded)* - [DEXV](https://dexv.lol) - Main Author
