import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type SensorSample = { x: number; y: number; z: number };

const API_URL = 'https://motiontrackerapp.onrender.com/predict';
const WINDOW_SIZE = 100; // 1 second at 100Hz
const OVERLAP = 0.5; // 50% overlap

export default function MotionScreen() {
  const [accel, setAccel] = useState<SensorSample>({ x: 0, y: 0, z: 0 });
  const [gyro, setGyro] = useState<SensorSample>({ x: 0, y: 0, z: 0 });
  const [prediction, setPrediction] = useState<string>('');
  const [error, setError] = useState<string>('');
  const bufferRef = React.useRef<{acc: SensorSample[], gyro: SensorSample[]}>({ acc: [], gyro: [] });
  const collectingRef = React.useRef<boolean>(true);

  useEffect(() => {
    Accelerometer.setUpdateInterval(10); // 100Hz
    Gyroscope.setUpdateInterval(10);    // 100Hz

    const accSub = Accelerometer.addListener((data) => {
      setAccel(data);
      if (collectingRef.current) bufferRef.current.acc.push(data);
    });
    const gyroSub = Gyroscope.addListener((data) => {
      setGyro(data);
      if (collectingRef.current) bufferRef.current.gyro.push(data);
    });

    // Main windowing and sending loop
    const interval = setInterval(() => {
      const accBuf = bufferRef.current.acc;
      const gyroBuf = bufferRef.current.gyro;
      // Only process if enough samples for a window
      while (accBuf.length >= WINDOW_SIZE && gyroBuf.length >= WINDOW_SIZE) {
        // Merge by index, shape: [ [accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z], ... ]
        const window: number[][] = [];
        for (let i = 0; i < WINDOW_SIZE; i++) {
          const a = accBuf[i];
          const g = gyroBuf[i];
          window.push([
            a?.x ?? 0, a?.y ?? 0, a?.z ?? 0,
            g?.x ?? 0, g?.y ?? 0, g?.z ?? 0
          ]);
        }
        // Send to backend
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ window })
        })
          .then(res => res.json())
          .then(data => {
            if (data.prediction) setPrediction(data.prediction);
            else setError(data.error || 'No prediction');
          })
          .catch(e => setError('Network error: ' + e));
        // Remove first WINDOW_SIZE * (1-OVERLAP) samples for 50% overlap
        const step = Math.floor(WINDOW_SIZE * (1 - OVERLAP));
        accBuf.splice(0, step);
        gyroBuf.splice(0, step);
      }
    }, 100); // Check every 100ms

    return () => {
      accSub.remove();
      gyroSub.remove();
      clearInterval(interval);
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Live Sensor Data</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accelerometer</Text>
        <Text style={styles.text}>{`x: ${accel.x.toFixed(4)}`}</Text>
        <Text style={styles.text}>{`y: ${accel.y.toFixed(4)}`}</Text>
        <Text style={styles.text}>{`z: ${accel.z.toFixed(4)}`}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gyroscope</Text>
        <Text style={styles.text}>{`x: ${gyro.x.toFixed(4)}`}</Text>
        <Text style={styles.text}>{`y: ${gyro.y.toFixed(4)}`}</Text>
        <Text style={styles.text}>{`z: ${gyro.z.toFixed(4)}`}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prediction</Text>
        <Text style={styles.text}>{prediction ? prediction : 'Waiting for prediction...'}</Text>
        {error ? <Text style={[styles.text, {color: 'red'}]}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#333' },
  text: { fontSize: 15, marginVertical: 2 },
});
