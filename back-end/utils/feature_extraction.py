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