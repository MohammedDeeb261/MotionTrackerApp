import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import axios from 'axios';

type SensorSample = { x: number; y: number; z: number };

export default function MotionScreen() {
  const [prediction, setPrediction] = useState<string>("");
  const [sampleCount, setSampleCount] = useState<number>(0);

  // Buffers to collect data for 1 second
  const accBuffer: SensorSample[] = [];
  const gyroBuffer: SensorSample[] = [];

  useEffect(() => {
    // 🔄 Set the sampling rate to 10 Hz (10 samples per second)
    Accelerometer.setUpdateInterval(100); // 10 Hz
    Gyroscope.setUpdateInterval(100);    // 10 Hz

    // Collect data in buffers
    const accSub = Accelerometer.addListener((data) => accBuffer.push(data));
    const gyroSub = Gyroscope.addListener((data) => gyroBuffer.push(data));

    // Send every 1 second (1000 ms)
    const interval = setInterval(async () => {
      if (accBuffer.length < 10 || gyroBuffer.length < 10) {
        console.warn("Not enough samples collected, skipping this window.");
        return;
      }

      // Display the number of samples collected
      setSampleCount(accBuffer.length);

      // Prepare the payload
      const rawData = {
        accelerometer: accBuffer,
        gyroscope: gyroBuffer,
      };

      try {
        const response = await axios.post('https://motiontrackerapp.onrender.com/predict', rawData);
        setPrediction(response.data.prediction);
      } catch (error) {
        console.error('Error calling /predict:', error);
      }

      // Clear the buffers
      accBuffer.length = 0;
      gyroBuffer.length = 0;
    }, 1000); // Send every 1 second

    return () => {
      accSub.remove();
      gyroSub.remove();
      clearInterval(interval);
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Motion Feature Summary</Text>
      <Text style={styles.subheader}>Samples per second: {sampleCount}</Text>
      <Text style={styles.prediction}>Prediction: {prediction}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  subheader: { fontSize: 16, fontWeight: "500", textAlign: "center", marginBottom: 10 },
  prediction: { fontSize: 16, fontWeight: "500", textAlign: "center", marginTop: 20, color: "#555" },
});
