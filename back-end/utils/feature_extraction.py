import numpy as np
import logging
import pandas as pd

def normalize(data, method='min-max'):
    """
    Normalizes the data using the specified method.
    Available methods:
        - 'min-max': Scales to [0, 1]
        - 'z-score': Scales to mean 0, std 1
        - 'max-abs': Scales to [-1, 1]
    
    Parameters:
        data (list or np.array): The data to normalize.
        method (str): The normalization method to apply.

    Returns:
        list: Normalized data.
    """
    data = np.array(data)
    
    if method == 'min-max':
        min_val = np.min(data)
        max_val = np.max(data)
        if min_val == max_val:
            return [0 for _ in data]
        return (data - min_val) / (max_val - min_val)

    elif method == 'z-score':
        mean = np.mean(data)
        std = np.std(data)
        if std == 0:
            return [0 for _ in data]
        return (data - mean) / std

    elif method == 'max-abs':
        max_val = np.max(np.abs(data))
        if max_val == 0:
            return [0 for _ in data]
        return data / max_val

    else:
        raise ValueError("Invalid normalization method. Choose from 'min-max', 'z-score', or 'max-abs'.")




def extract_features(df, normalization_method='min-max'):
    """
    Extracts and normalizes features from a DataFrame.
    
    Parameters:
        df (pd.DataFrame): The input data.
        normalization_method (str): The normalization method ('min-max', 'z-score', 'max-abs').

    Returns:
        list: Extracted and normalized features.
    """
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

            # Extract raw features
            raw_features = [
                series.mean(),
                series.std(),
                np.sqrt(np.mean(series**2)),  # RMS
                series.max(),
                series.min()
            ]

            # Normalize features
            normalized_features = normalize(raw_features, method=normalization_method)

            # Append to the list of features
            features.extend(normalized_features)

        # Clean non-numeric data for SMA calculation
        for col in ['acc_x', 'acc_y', 'acc_z']:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        if df[['acc_x', 'acc_y', 'acc_z']].isnull().any().any():
            logging.warning("Non-numeric data found in accelerometer columns. Dropping rows with NaN values.")
            df = df.dropna(subset=['acc_x', 'acc_y', 'acc_z'])

        if len(df) == 0:
            raise ValueError("All rows were dropped due to non-numeric data in accelerometer columns.")

        # Signal Magnitude Area (SMA)
        sma = np.sum(np.abs(df[['acc_x', 'acc_y', 'acc_z']]).sum(axis=0)) / len(df)

        # Normalize SMA
        sma_normalized = normalize([sma], method=normalization_method)
        features.append(sma_normalized[0])

        # Log the extracted features for debugging
        logging.debug(f"Extracted features: {features}")

    except Exception as e:
        logging.error(f"Error extracting features: {e}")
        raise

    return features

def extract_features_from_raw_data(acc_data, gyro_data, normalization_method='min-max'):
    """
    Extract features from raw accelerometer and gyroscope data.
    
    Parameters:
        acc_data (list): List of accelerometer samples [{x, y, z}, ...]
        gyro_data (list): List of gyroscope samples [{x, y, z}, ...]
        normalization_method (str): The normalization method ('min-max', 'z-score', 'max-abs').

    Returns:
        list: Extracted and normalized features.
    """
    def compute_stats(data):
        clean_data = data
        if len(clean_data) == 0:
            return [0, 0, 0, 0, 0]  # mean, std, rms, max, min

        mean = np.mean(clean_data)
        std = np.std(clean_data)
        rms = np.sqrt(np.mean(np.square(clean_data)))
        max_val = np.max(clean_data)
        min_val = np.min(clean_data)

        # Normalize the stats
        stats = [mean, std, rms, max_val, min_val]
        return normalize(stats, method=normalization_method)

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
    
    # Normalize SMA
    sma_normalized = normalize([sma], method=normalization_method)
    features.append(sma_normalized[0])

    features.extend(compute_stats(gyro_x))
    features.extend(compute_stats(gyro_y))
    features.extend(compute_stats(gyro_z))

    return features
