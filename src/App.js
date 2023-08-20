import { useEffect, useState, useRef } from 'react';
import glur from 'glur/mono16';
import './App.css';

function App() {
  const [hr, setHr] = useState(null);

  return (
    <div className="App">
      <Webcam hrHandler={setHr} />
      <p>{hr ?? "No data"}</p>
    </div>
  );
}

function diff(arr) {
  const dx = [];
  for (let i = 0; i < arr.length - 1; i++) {
    dx.push(arr[i + 1] - arr[i]);
  }
  return dx;
}

function max(arr) {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (max < arr[i]) {
      max = arr[i];
    }
  }
  return max;
}

function Webcam(setHr) {
  const webcamRef = useRef(null);
  const frames_intensity = useRef([]);
  const frames_time = useRef([]);
  const framesSinceChecked = useRef(0);

  const getHeartrate = (frames_intensity, frames_time) => {
    const dx = diff(frames_intensity);

    let max_seq_len = 0, max_seq = [null, null];
    let seq_start = -1, seq_end = -1;

    for (let i = 20; i < dx.length; i++) {
      if (max(dx.slice(i - 20, i)) < 5) {
        if (seq_start === -1) {
          seq_start = i;
        }
        seq_end = i;
      } else {
        if (seq_end !== -1) {
          const seq_len = seq_end - seq_start;
          if (seq_len > max_seq_len) {
            max_seq = [seq_start, seq_end];
            max_seq_len = seq_len;
          }
          seq_start = -1;
          seq_end = -1;
        }
      }

      if (i >= dx.length - 1) {
        max_seq = [seq_start, seq_end];
        max_seq_len = seq_end - seq_start;
      }
    }

    const heart_peaks = new Uint16Array(frames_intensity.slice(max_seq[0], max_seq[1]));
    // Write apply a gaussian filter to heart_peaks
    glur(heart_peaks, heart_peaks.length, 1, 5);
    const sp_dx = diff(heart_peaks);
    
    //     hb_idx = [i + max_seq[0] for i in range(len(sp_dx) - 1) if sp_dx[i] >= 0 and sp_dx[i+1] < 0]
    const hb_idx = [];

    sp_dx.forEach((val, i) => {
      if (val >= 0 && sp_dx[i+1] < 0) {
        hb_idx.push(i + max_seq[0]);
      }  
    });
    console.log(hb_idx);

    // console.log(hb_idx[hb_idx.length - 1]);
    // console.log(frames_time.length);
    const total_time = frames_time[hb_idx[hb_idx.length - 1]] - frames_time[hb_idx[0]];
    // console.log(total_time);
  
    if (hb_idx.length < 5) {
      return null;
    }

    const heart_rate = ((hb_idx.length - 1) / total_time) * 1000 * 60;
    return heart_rate;
  };

  useEffect(() => {
    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          webcamRef.current.srcObject = stream;
          
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { willReadFrequently: true });
          
          const drawFrame = () => {
            context.drawImage(webcamRef.current, 0, 0);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            const pixelMean = imageData.data.reduce((a, b, index) => {
              if (index % 4 !== 3) {
                return a + b;
              } else {
                return a;
              }
            }, 0) / (imageData.data.length * 3 / 4);

            frames_intensity.current.push(pixelMean);
            frames_time.current.push(Date.now());
            if (frames_intensity.current.length > 500) {
              frames_intensity.current.shift();
              frames_time.current.shift();
            }
            framesSinceChecked.current += 1;

            if (framesSinceChecked.current >= 100) {
              framesSinceChecked.current = 0;
              let heartrate = getHeartrate(frames_intensity.current, frames_time.current);
              console.log(`HELLO: ${heartrate}`)
            }
            
            requestAnimationFrame(drawFrame);
          };

          webcamRef.current.addEventListener("play", () => {
            canvas.width = webcamRef.current.videoWidth;
            canvas.height = webcamRef.current.videoHeight;
            drawFrame();
          })
        })
    }
  }, [])

  return (
    <video ref={webcamRef} autoPlay />
  );
}

export default App;
