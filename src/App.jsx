import React, { useState, useRef } from 'react';
import { Upload, Download, Play, Pause, Volume2, AlertCircle } from 'lucide-react';

export default function App() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('th-TH-PremwadeeNeural');
  const [rate, setRate] = useState(20); // -50 ถึง 100
  const [pitch, setPitch] = useState(-5); // -50 ถึง 50
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  // ⚠️ เปลี่ยน URL นี้เป็น URL ของ Render.com ของคุณ
  const API_URL = import.meta.env.VITE_API_URL || 'https://tts-backend-1-h80q.onrender.com';

  const thaiVoices = [
    { value: 'th-TH-PremwadeeNeural', label: 'เปรมวดี (ผู้หญิง)' },
    { value: 'th-TH-NiwatNeural', label: 'นิวัฒน์ (ผู้ชาย)' },
    { value: 'th-TH-AcharaNeural', label: 'อัจฉรา (ผู้หญิง)' }
  ];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => {
        setText(event.target.result);
        setError('');
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      setError('กรุณาเลือกไฟล์ .txt เท่านั้น');
    }
  };

  const handleStreamPlay = async () => {
    if (!text.trim()) {
      setError('กรุณาใส่ข้อความที่ต้องการอ่าน');
      return;
    }

    setLoading(true);
    setProgress(0);
    setError('');

    try {
      const response = await fetch(`${API_URL}/tts/stream-chunks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: voice,
          rate: `${rate >= 0 ? '+' : ''}${rate}%`,
          pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz`
        })
      });

      if (!response.ok) {
        throw new Error('ไม่สามารถสร้างเสียงได้');
      }

      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // อัพเดท progress
        if (total > 0) {
          setProgress(Math.round((receivedLength / total) * 100));
        } else {
          // ถ้าไม่รู้ content-length ให้แสดงแบบไม่มีกำหนด
          setProgress(Math.min(receivedLength / 1000, 99));
        }
      }

      setProgress(100);

      // รวม chunks
      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (let chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      // สร้าง blob และเล่น
      const blob = new Blob([chunksAll], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.oncanplay = () => {
          audioRef.current.play();
          setIsPlaying(true);
          setLoading(false);
          setProgress(0);
        };
        audioRef.current.load();
      }
    } catch (err) {
      console.error('Error:', err);
      setError('เกิดข้อผิดพลาด: ' + err.message);
      setLoading(false);
      setProgress(0);
    }
  };

  const handleSaveMP3 = async () => {
    if (!text.trim()) {
      setError('กรุณาใส่ข้อความที่ต้องการอ่าน');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/tts/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: voice,
          rate: `${rate >= 0 ? '+' : ''}${rate}%`,
          pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz`
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'ไม่สามารถสร้างไฟล์ได้');
      }

      // ดึง filename จาก header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `tts_${new Date().getTime()}.mp3`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // แปลง response เป็น blob
      const blob = await response.blob();
      
      // สร้าง URL และดาวน์โหลด
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      console.log('ดาวน์โหลดสำเร็จ:', filename);
    } catch (err) {
      console.error('Error:', err);
      setError('เกิดข้อผิดพลาด: ' + err.message + '\n\nกรุณาตรวจสอบว่า Backend ทำงานอยู่');
    } finally {
      setLoading(false);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Volume2 className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              Text-to-Speech
            </h1>
          </div>
          <p className="text-gray-600">แปลงข้อความเป็นเสียงพูดภาษาไทย</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-700 whitespace-pre-line">{error}</div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Voice Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              เลือกเสียง
            </label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
            >
              {thaiVoices.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Speed Control */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ความเร็ว: {rate > 0 ? '+' : ''}{rate}% {rate === 0 ? '(ปกติ)' : rate > 0 ? '(เร็วขึ้น)' : '(ช้าลง)'}
            </label>
            <input
              type="range"
              min="-50"
              max="100"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #9333ea 0%, #9333ea ${(rate + 50) / 1.5}%, #e5e7eb ${(rate + 50) / 1.5}%, #e5e7eb 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>-50% (ช้ามาก)</span>
              <span>20% (เร็ว)</span>
              <span>+100% (เร็วมาก)</span>
            </div>
          </div>

          {/* Pitch Control */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ระดับเสียง: {pitch > 0 ? '+' : ''}{pitch}Hz {pitch === 0 ? '(ปกติ)' : pitch > 0 ? '(สูงขึ้น)' : '(ต่ำลง)'}
            </label>
            <input
              type="range"
              min="-50"
              max="50"
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #2563eb 0%, #2563eb ${(pitch + 50)}%, #e5e7eb ${(pitch + 50)}%, #e5e7eb 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>-50Hz (ต่ำมาก)</span>
              <span>0Hz (ปกติ)</span>
              <span>+50Hz (สูงมาก)</span>
            </div>
          </div>

          {/* Text Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ข้อความที่ต้องการอ่าน
            </label>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError('');
              }}
              placeholder="พิมพ์ข้อความที่นี่... เช่น สวัสดีครับ วันนี้อากาศดีมากเลยนะ"
              className="w-full h-40 p-4 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors resize-none"
            />
            <div className="text-sm text-gray-500 mt-2">
              {text.length} ตัวอักษร
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              อัปโหลดไฟล์ .txt
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleStreamPlay}
              disabled={loading || !text.trim()}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {progress > 0 ? `${progress}%` : 'กำลังประมวลผล...'}
                </>
              ) : (
                <>
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  เล่นเสียง (Stream)
                </>
              )}
            </button>

            <button
              onClick={handleSaveMP3}
              disabled={loading || !text.trim()}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังประมวลผล...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  บันทึกเป็น MP3
                </>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {loading && progress > 0 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 text-center mt-2">
                กำลังโหลด... {progress}%
              </p>
            </div>
          )}

          {/* Audio Player (Hidden) */}
          <audio
            ref={audioRef}
            onEnded={handleAudioEnded}
            className="hidden"
          />
        </div>

        {/* Quick Test */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-3">💡 ทดสอบด่วน</h3>
          <button
            onClick={() => setText('สวัสดีครับ ยินดีต้อนรับสู่ระบบแปลงข้อความเป็นเสียง')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            ใส่ข้อความตัวอย่าง
          </button>
        </div>
      </div>
    </div>
  );
}