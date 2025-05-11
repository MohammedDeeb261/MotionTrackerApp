import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import axios from 'axios';

type SensorSample = { x: number; y: number; z: number };

export default function MotionScreen() {
  const [prediction, setPrediction] = useState<string>("");

  const accBuffer: SensorSample[] = [];
  const gyroBuffer: SensorSample[] = [];
  const predictions: string[] = [];

  useEffect(() => {
    Accelerometer.setUpdateInterval(1000); // 1 Hz (every 1 second)
    Gyroscope.setUpdateInterval(1000);    // 1 Hz

    const accSub = Accelerometer.addListener((data) => accBuffer.push(data));
    const gyroSub = Gyroscope.addListener((data) => gyroBuffer.push(data));

    const interval = setInterval(async () => {
      if (accBuffer.length === 0 || gyroBuffer.length === 0) return;

      // Send raw accelerometer and gyroscope data to the back-end
      const rawData = {
        accelerometer: accBuffer,
        gyroscope: gyroBuffer,
      };

      try {
        const response = await axios.post('https://motiontrackerapp.onrender.com/predict', rawData);
        predictions.push(response.data.prediction);
      } catch (error) {
        console.error('Error calling /predict:', error);
      }

      accBuffer.length = 0;
      gyroBuffer.length = 0;
    }, 1000); // Every 1 second

    const votingInterval = setInterval(() => {
      if (predictions.length >= 5) { // 5-second activity duration
        const finalPrediction = predictions.reduce((a, b, i, arr) =>
          arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
        );
        setPrediction(finalPrediction);
        predictions.length = 0;
      }
    }, 5000); // Every 5 seconds

    return () => {
      accSub.remove();
      gyroSub.remove();
      clearInterval(interval);
      clearInterval(votingInterval);
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Motion Feature Summary</Text>
      <Text style={styles.prediction}>Prediction: {prediction}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  prediction: { fontSize: 16, fontWeight: "500", textAlign: "center", marginTop: 20, color: "#555" },
});
