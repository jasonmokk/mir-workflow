import { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls } from './viz.js';
import { preprocess, shortenAudio } from './audioUtils.js';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const KEEP_PERCENTAGE = 0.15; // keep only 15% of audio file

let essentia = null;
let essentiaAnalysis;
let featureExtractionWorker = null;
let inferenceWorkers = {};
const modelNames = ['mood_happy' , 'mood_sad', 'mood_relaxed', 'mood_aggressive', 'danceability'];
let inferenceResultPromises = [];

const resultsViz = new AnalysisResults(modelNames);
let wavesurfer;
let controls;

const dropInput = document.createElement('input');
dropInput.setAttribute('type', 'file');
dropInput.setAttribute('multiple', '');
dropInput.addEventListener('change', () => {
    processFileUpload(dropInput.files);
})

const dropArea = document.querySelector('#file-drop-area');
dropArea.addEventListener('dragover', (e) => { e.preventDefault() });
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    processFileUpload(files);
})
dropArea.addEventListener('click', () => {
    dropInput.click();
})

// Add queue variables for batch processing
let filesQueue = [];
let isProcessing = false;

let analysedTracks = [];
let currentAnalysingFile = null;

function processFileUpload(files) {
    if (!files || !files.length) return;

    // push incoming files into queue
    for (let i = 0; i < files.length; i++) {
        filesQueue.push(files[i]);
    }

    // start processing if idle
    if (!isProcessing) {
        processNextFile();
    }

    // reset the input so same file set can be selected again
    dropInput.value = "";
}

function processNextFile() {
    if (!filesQueue.length) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const file = filesQueue.shift();
    currentAnalysingFile = file;

    // Prepare / reuse wavesurfer UI
    if (!wavesurfer) {
        wavesurfer = toggleUploadDisplayHTML('display');
        controls = new PlaybackControls(wavesurfer);
    }

    wavesurfer.loadBlob(file);
    if (controls) controls.toggleEnabled(false);

    // Decode and analyse
    file.arrayBuffer().then((ab) => {
        decodeFile(ab);
    });
}

function queueNextFile() {
    // Called after finishing analysis of current file
    if (filesQueue.length) {
        // slight delay to let UI breathe
        setTimeout(() => {
            processNextFile();
        }, 100);
    } else {
        isProcessing = false;
    }
}

function decodeFile(arrayBuffer) {
    audioCtx.resume().then(() => {
        audioCtx.decodeAudioData(arrayBuffer).then(async function handleDecodedAudio(audioBuffer) {
            console.info("Done decoding audio!");
            
            toggleLoader();
            
            const prepocessedAudio = preprocess(audioBuffer);
            await audioCtx.suspend();

            if (essentia) {
                essentiaAnalysis = computeKeyBPM(prepocessedAudio);
            }

            // reduce amount of audio to analyse
            let audioData = shortenAudio(prepocessedAudio, KEEP_PERCENTAGE, true); // <-- TRIMMED start/end

            // send for feature extraction
            createFeatureExtractionWorker();

            featureExtractionWorker.postMessage({
                audio: audioData.buffer
            }, [audioData.buffer]);
            audioData = null;
        })
    })
}

function computeKeyBPM (audioSignal) {
    let vectorSignal = essentia.arrayToVector(audioSignal);
    const keyData = essentia.KeyExtractor(vectorSignal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', 16000, 0.0001, 440, 'cosine', 'hann');
    const bpm = essentia.PercivalBpmEstimator(vectorSignal, 1024, 2048, 128, 128, 210, 50, 16000).bpm;
    
    // const bpm = essentia.RhythmExtractor(vectorSignal, 1024, 1024, 256, 0.1, 208, 40, 1024, 16000, [], 0.24, true, true).bpm;
    // const bpm = essentia.RhythmExtractor2013(vectorSignal, 208, 'multifeature', 40).bpm;

    return {
        keyData: keyData,
        bpm: bpm
    };
}

function createFeatureExtractionWorker() {
    featureExtractionWorker = new Worker('./src/featureExtraction.js');
    featureExtractionWorker.onmessage = function listenToFeatureExtractionWorker(msg) {
        // feed to models
        if (msg.data.features) {
            modelNames.forEach((n) => {
                // send features off to each of the models
                inferenceWorkers[n].postMessage({
                    features: msg.data.features
                });
            });
            msg.data.features = null;
        }
        // free worker resource until next audio is uploaded
        featureExtractionWorker.terminate();
    };
}

function createInferenceWorkers() {
    modelNames.forEach((n) => { 
        inferenceWorkers[n] = new Worker('./src/inference.js');
        inferenceWorkers[n].postMessage({
            name: n
        });
        inferenceWorkers[n].onmessage = function listenToWorker(msg) {
            // listen out for model output
            if (msg.data.predictions) {
                const preds = msg.data.predictions;
                // emmit event to PredictionCollector object
                inferenceResultPromises.push(new Promise((res) => {
                    res({ [n]: preds });
                }));
                collectPredictions();
                console.log(`${n} predictions: `, preds);
            }
        };
    });
}

function collectPredictions() {
    if (inferenceResultPromises.length == modelNames.length) {
        Promise.all(inferenceResultPromises).then((predictions) => {
            const allPredictions = {};
            Object.assign(allPredictions, ...predictions);
            resultsViz.updateMeters(allPredictions);
            resultsViz.updateValueBoxes(essentiaAnalysis);

            // store results in history
            analysedTracks.push({
                file: currentAnalysingFile,
                predictions: allPredictions,
                essentia: essentiaAnalysis
            });
            addTrackToHistory(analysedTracks.length - 1, currentAnalysingFile.name);

            toggleLoader();
            controls.toggleEnabled(true)

            // terminate existing inference workers and create fresh ones for next audio to
            // ensure models are reloaded (workers dispose models after inference)
            Object.values(inferenceWorkers).forEach(w => w.terminate());
            inferenceWorkers = {};
            createInferenceWorkers();

            // proceed with next file in queue (if any)
            inferenceResultPromises = []; // clear array first
            queueNextFile();
        })
    }
}

function toggleLoader() {
    const loader = document.querySelector('#loader');
    loader.classList.toggle('disabled');
    loader.classList.toggle('active')
}

function addTrackToHistory(index, name) {
    const list = document.querySelector('#track-list');
    if (!list) return;
    const li = document.createElement('li');
    li.textContent = name;
    li.dataset.index = index;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
        loadTrackFromHistory(Number(li.dataset.index));
    });
    list.appendChild(li);
}

function loadTrackFromHistory(index) {
    const track = analysedTracks[index];
    if (!track) return;
    if (wavesurfer) {
        wavesurfer.loadBlob(track.file);
    }
    // update UI with stored results
    resultsViz.updateMeters(track.predictions);
    resultsViz.updateValueBoxes(track.essentia);
    if (controls) controls.toggleEnabled(true);
}

window.onload = () => {
    createInferenceWorkers();
    EssentiaWASM().then((wasmModule) => {
        essentia = new wasmModule.EssentiaJS(false);
        essentia.arrayToVector = wasmModule.arrayToVector;
    })
};
