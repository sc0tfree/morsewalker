<h1>
Morse Walker
<img
    src="./src/img/morsewalker-logo.png"
    alt="Morse Walker logo"
    style="vertical-align: top;"
    height="40" />
</h1>

Morse Walker is a web-based CW pileup training application inspired by VE3NEA's Morse Runner.
This tool allows amateur radio operators to practice different contesting and activation scenarios,
improve their pileup handling skills, and enhance their overall proficiency in CW.

**Visit [MorseWalker.com](https://morsewalker.com) to start practicing your CW pileup skills!**

### Supported Modes

- Single Caller - only one station responding at a time.
- Basic Contest - exchange callsign and serial number.
- POTA Activator - exchange callsign and state in a POTA-style format.
- CW Ops Test (CWT) - exchange callsign, name and CW Ops number in the CWT QSO format.
- K1USN SST - exchange callsign, name, and state in the SST QSO format.

### How to "Cheat"

To help you get started, or to diagnose software issues, Morse Walker includes a "cheat" mode that displays the callsign
and other information of the responding stations. To see
this, [open your browser's JavaScript console](https://help.lucid.co/hc/en-us/articles/360049395772-Troubleshooting-Open-the-JavaScript-Console).

## How it Works

Morse Walker leverages the Web Audio API to generate realistic CW tones. It generates randomized station objects, each
containing its own cw player (with unique wpm, tone, and volume) that is driven by an `OscillatorNode` within a shared
`AudioContext`. A `GainNode` is added to simulate optional QSB, which is controlled via depth, frequency, and randomized
phase offsets for natural variation. The volumes of grouped oscillators (i.e., responding stations in a pileup) are
normalized to prevent audio popping. The shared `AudioContext` allows fore more efficient resource management, enabling
multiple stations to play simultaneously without any significant performance degradation.

View the JSDocs at https://morsewalker.com/docs.

## Local Development

### Prerequisites

- Node.js and npm
- A modern web browser

### Installation

1. Clone the repository: `git clone https://github.com/sc0tfree/morsewalker.git && cd morsewalker`
1. Install dependencies: `npm install`
1. Start the development server: `npm start`

This will open the application in your default browser.

### With Docker Compose (recommended)

```bash
docker-compose up --build
```

Then open http://localhost:8080

### With Docker directly

```bash
docker build -t morsewalker .
docker run -p 8080:8080 morsewalker
```


#### Building for Production

To build the project for production, run: `npm run build`

The build files will be located in the `dist` directory.

# Feedback and Contributions

Morse Walker is currently in beta, and your feedback is invaluable!

If you encounter any bugs or have feature requests,
[submit a GitHub issue](https://github.com/sc0tfree/morsewalker/issues/new/choose),
or email me at [henry@w6nyc.com](mailto:henry@w6nyc.com).

Or, if you're feeling adventurous, fork the repository and submit a pull request!
