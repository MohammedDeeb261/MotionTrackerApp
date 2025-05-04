import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type SensorSample = { x: number; y: number; z: number };

export default function MotionScreen() {
  const [features, setFeatures] = useState<Record<string, number>>({});

  const accBuffer: SensorSample[] = [];
  const gyroBuffer: SensorSample[] = [];

  useEffect(() => {
    Accelerometer.setUpdateInterval(100); // 10 Hz
    Gyroscope.setUpdateInterval(100);     // 10 Hz

    const accSub = Accelerometer.addListener((data) => accBuffer.push(data));
    const gyroSub = Gyroscope.addListener((data) => gyroBuffer.push(data));

    const interval = setInterval(() => {
      if (accBuffer.length === 0 || gyroBuffer.length === 0) return;

      const computeStats = (arr: number[]) => {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = Math.sqrt(arr.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / arr.length);
        const rms = Math.sqrt(arr.map(x => x ** 2).reduce((a, b) => a + b, 0) / arr.length);
        return { mean, std, rms, max: Math.max(...arr), min: Math.min(...arr) };
      };

      const getStats = (buffer: SensorSample[], prefix: string) => {
        const x = buffer.map(s => s.x);
        const y = buffer.map(s => s.y);
        const z = buffer.map(s => s.z);
        const fx = computeStats(x);
        const fy = computeStats(y);
        const fz = computeStats(z);

        return {
          [`${prefix}_meanX`]: fx.mean, [`${prefix}_stdX`]: fx.std, [`${prefix}_rmsX`]: fx.rms, [`${prefix}_maxX`]: fx.max, [`${prefix}_minX`]: fx.min,
          [`${prefix}_meanY`]: fy.mean, [`${prefix}_stdY`]: fy.std, [`${prefix}_rmsY`]: fy.rms, [`${prefix}_maxY`]: fy.max, [`${prefix}_minY`]: fy.min,
          [`${prefix}_meanZ`]: fz.mean, [`${prefix}_stdZ`]: fz.std, [`${prefix}_rmsZ`]: fz.rms, [`${prefix}_maxZ`]: fz.max, [`${prefix}_minZ`]: fz.min,
        };
      };

      const accStats = getStats(accBuffer, "acc");
      const gyroStats = getStats(gyroBuffer, "gyro");
      const sma = accBuffer.map((s) => Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)).reduce((a, b) => a + b, 0) / accBuffer.length;

      setFeatures({
        ...accStats,
        acc_sma: sma,
        ...gyroStats,
      });

      accBuffer.length = 0;
      gyroBuffer.length = 0;
    }, 1000);

    return () => {
      accSub.remove();
      gyroSub.remove();
      clearInterval(interval);
    };
  }, []);

  const renderFeatureGroup = (title: string, prefix: string) => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {["mean", "std", "rms", "max", "min"].map(stat =>
          ["X", "Y", "Z"].map(axis => {
            const key = `${prefix}_${stat}${axis}`;
            const value = features[key];
            return (
              <Text key={key} style={styles.text}>
                {key}: {Number.isFinite(value) ? value.toFixed(4) : "---"}
              </Text>
            );
          })
        )}
        {prefix === "acc" && (
          <Text style={styles.text}>acc_sma: {Number.isFinite(features.acc_sma) ? features.acc_sma.toFixed(4) : "---"}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Motion Feature Summary</Text>
      {renderFeatureGroup("Accelerometer Features", "acc")}
      {renderFeatureGroup("Gyroscope Features", "gyro")}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: "#333" },
  text: { fontSize: 15, marginVertical: 2 },
});
