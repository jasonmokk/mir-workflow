<div align="center">

# MIR Audio Analysis Tool

**Automated music information retrieval using deep learning models**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.52.0-blue.svg)](https://playwright.dev/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-3.5.0-orange.svg)](https://www.tensorflow.org/js)

</div>

## What is it?

MIR Audio Analysis Tool is a Python and JavaScript-based system that provides automated music information retrieval using pre-trained deep learning models. It is designed to make large-scale music analysis both easy and efficient for researchers in computational musicology, music psychology, and related fields. The tool processes entire music collections and extracts interpretable features including mood classifications, rhythmic characteristics, and harmonic content.

## Table of Contents

- [Main Features](#main-features)
- [Where to get it](#where-to-get-it)
- [Dependencies](#dependencies)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Analysis Output](#analysis-output)
- [Performance](#performance)
- [Technical Implementation](#technical-implementation)
- [Citation](#citation)
- [Contributing](#contributing)
- [License](#license)

## Main Features

Here are the key capabilities of the MIR Audio Analysis Tool:

- **Automated batch processing** of entire music collections with a single command
- **Multi-dimensional mood analysis** using CNN-based models trained on the Million Song Dataset
- **Musical feature extraction** including tempo (BPM), key detection, and danceability scoring
- **Research-ready CSV output** for statistical analysis and data visualization
- **Multiple audio format support** (MP3, WAV, FLAC, OGG, M4A, AAC)
- **Memory-optimized processing** for handling large datasets efficiently
- **Browser-based analysis engine** using Essentia.js and TensorFlow.js for reproducible results
- **Robust error handling** and detailed logging for research validation

## Where to get it

The source code is currently hosted on GitHub at: https://github.com/jasonmokk/mir-workflow

```bash
git clone https://github.com/jasonmokk/mir-workflow.git
cd mir-workflow
npm install
```

## Dependencies

- **Node.js 16+** - JavaScript runtime for automation and server components
- **Playwright** - Browser automation for analysis engine
- **Essentia.js** - Audio analysis library and feature extraction
- **TensorFlow.js** - Machine learning model inference
- **Express.js** - Web server for analysis interface

## Installation

### From GitHub

```bash
git clone https://github.com/jasonmokk/mir-workflow.git
cd mir-workflow
npm install
npx playwright@1.52.0 install
```

## Quick Start

1. **Add your audio files** to the `data/` directory
2. **Run the analysis**:
   ```bash
   npm start
   ```
3. **Results** will be saved to `results/music_analysis_results_01.csv`

The tool automatically processes all supported audio files in batches and generates a comprehensive CSV dataset ready for statistical analysis.

## Analysis Output

The tool extracts the following features for each audio file:

| Feature | Description | Output Range |
|---------|-------------|--------------|
| **Danceability** | Rhythmic suitability for dancing | 0-100% |
| **Happy** | Positive emotional valence | 0-100% |
| **Sad** | Negative emotional valence | 0-100% |
| **Relaxed** | Low-energy, calm characteristics | 0-100% |
| **Aggressive** | High-energy, intense characteristics | 0-100% |
| **BPM** | Beats per minute (tempo) | Numeric |
| **Key** | Detected musical key | String |

### Output Format

```csv
filename,danceability,happy,sad,relaxed,aggressive,bpm,key
song1.mp3,85.2,72.1,12.3,45.6,23.8,128,C major
song2.wav,67.4,34.2,67.8,78.9,8.1,95,A minor
```

Each analysis run creates numbered result files with no data carryover between runs.

## Performance

Processing time varies based on collection size and audio format:

| Collection Size | Estimated Time |
|----------------|---------------|
| 10-50 files | 10-15 minutes |
| 100-200 files | 45-60 minutes |
| 400+ files | 2-3 hours |

**Note:** MP3 files generally process fastest. Files larger than 100MB are automatically skipped.

## Technical Implementation

### Architecture

- **Frontend**: Essentia.js web application with TensorFlow.js model inference
- **Backend**: Express.js server with Playwright browser automation
- **Processing**: WebAssembly-optimized batch processing with memory management
- **Models**: MusiCNN architecture trained on Million Song Dataset (MSD-2)

### Processing Pipeline

1. **Audio Loading** - Batch file processing with format validation
2. **Feature Extraction** - Essentia.js spectral and temporal analysis
3. **Model Inference** - CNN-based classification for mood and rhythm
4. **Harmonic Analysis** - Key detection using pitch class profiles
5. **Beat Tracking** - BPM extraction through onset detection
6. **Data Export** - Structured CSV output with validation

### Model Details

The analysis uses pre-trained MusiCNN models:
- **Training Dataset**: Million Song Dataset (MSD-2)
- **Architecture**: Deep Convolutional Neural Network optimized for music
- **Inference**: Real-time processing via WebAssembly and TensorFlow.js
- **Output**: Multi-label classification for mood and rhythm characteristics

## Advanced Usage

### Manual Analysis Mode

Start the web interface for individual file analysis:
```bash
npm run server
```
Access at `http://localhost:3000`

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `Node.js not found` | Install Node.js 16+ from [nodejs.org](https://nodejs.org/) |
| `No audio files found` | Add audio files to the `data/` directory |
| `Browser launch failed` | Run `npx playwright install` |
| `Analysis hangs` | Try with fewer files first, check for corrupted audio files |

## Citation

If you use this tool in academic research, please cite the underlying Essentia.js framework:

```bibtex
@software{essentia_js,
  title={Essentia.js: Real-time music analysis in the browser},
  author={Music Technology Group (MTG)},
  organization={Universitat Pompeu Fabra},
  url={https://essentia.upf.edu/},
  year={2019}
}
```

## Contributing

Contributions, bug reports, bug fixes, documentation improvements, enhancements, and ideas are welcome.

A detailed overview of how to contribute can be found in the [contributing guide](CONTRIBUTING.md).

If you are looking to start working with the MIR Audio Analysis Tool codebase, navigate to the GitHub "issues" tab and start looking through interesting issues marked with "good first issue" or "help wanted".

## License

[MIT License](LICENSE) - Free for academic and commercial use.

---

<div align="center">

**Built for music researchers and computational musicology**

</div>
