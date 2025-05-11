import numpy as np
import pandas as pd
import logging

def extract_features(df):
    features = []
    try:
        for col in ['acc_x', 'acc_y', 'acc_z', 'gyro_x', 'gyro_y', 'gyro_z']:
            if col not in df.columns:
                raise ValueError(f"Missing expected column: {col}")

            series = df[col]

            # Log the column data for debugging
            logging.debug(f"Column {col} data before cleaning: {series.tolist()}")

            # Clean non-numeric data
            series = pd.to_numeric(series, errors='coerce')
            if series.isnull().any():
                logging.warning(f"Non-numeric data found in column: {col}. Replacing with NaN and dropping rows.")
                df = df.dropna(subset=[col])

            features.extend([
                series.mean(),
                series.std(),
                np.sqrt(np.mean(series**2)),  # RMS
                series.max(),
                series.min()
            ])

        # Clean non-numeric data for SMA calculation
        for col in ['acc_x', 'acc_y', 'acc_z']:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        if df[['acc_x', 'acc_y', 'acc_z']].isnull().any().any():
            logging.warning("Non-numeric data found in accelerometer columns. Dropping rows with NaN values.")
            df = df.dropna(subset=['acc_x', 'acc_y', 'acc_z'])

        if len(df) == 0:
            raise ValueError("All rows were dropped due to non-numeric data in accelerometer columns.")

        sma = np.sum(np.abs(df[['acc_x', 'acc_y', 'acc_z']]).sum(axis=0)) / len(df)
        features.append(sma)

        # Log the extracted features for debugging
        logging.debug(f"Extracted features: {features}")

    except Exception as e:
        logging.error(f"Error extracting features: {e}")
        raise

    return features

def extract_features_from_raw_data(acc_data, gyro_data):
    """
    Extract features from raw accelerometer and gyroscope data.
    :param acc_data: List of accelerometer samples [{x, y, z}, ...]
    :param gyro_data: List of gyroscope samples [{x, y, z}, ...]
    :return: List of extracted features
    """
    def compute_stats(data):
        clean_data = [d for d in data if not np.isnan(d)]
        if len(clean_data) == 0:
            return [0, 0, 0, 0, 0]  # mean, std, rms, max, min

        mean = np.mean(clean_data)
        std = np.std(clean_data)
        rms = np.sqrt(np.mean(np.square(clean_data)))
        max_val = np.max(clean_data)
        min_val = np.min(clean_data)
        return [mean, std, rms, max_val, min_val]

    acc_x = [sample['x'] for sample in acc_data]
    acc_y = [sample['y'] for sample in acc_data]
    acc_z = [sample['z'] for sample in acc_data]

    gyro_x = [sample['x'] for sample in gyro_data]
    gyro_y = [sample['y'] for sample in gyro_data]
    gyro_z = [sample['z'] for sample in gyro_data]

    features = []
    features.extend(compute_stats(acc_x))
    features.extend(compute_stats(acc_y))
    features.extend(compute_stats(acc_z))

    # Calculate SMA for accelerometer data
    sma = np.mean([np.abs(sample['x']) + np.abs(sample['y']) + np.abs(sample['z']) for sample in acc_data])
    features.append(sma)

    features.extend(compute_stats(gyro_x))
    features.extend(compute_stats(gyro_y))
    features.extend(compute_stats(gyro_z))

    return features