import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
import shutil


# Settings
DATA_DIR = 'data/all_data'
CLASSES = ['walk', 'stand', 'run']
SAMPLES_PER_SECOND = 25  # Downsampled rate
WINDOW_SECONDS = 2       # Window size in seconds
N_CHANNELS = 6           # accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z

WINDOW_SIZE = SAMPLES_PER_SECOND * WINDOW_SECONDS

# Map class names to integer labels
def class_to_label(class_name):
    return CLASSES.index(class_name)

def load_and_downsample_csv(file_path, downsample_factor=4):
    col_names = ['accel_time', 'accel_x', 'accel_y', 'accel_z', 'gyro_time', 'gyro_x', 'gyro_y', 'gyro_z']
    df = pd.read_csv(file_path, header=None, names=col_names)
    # Keep all columns including time stamps
    df_down = df.iloc[::downsample_factor, :].reset_index(drop=True)
    return df_down

# New function to copy and downsample all files to a new folder
def downsample_and_copy_all():
    output_root = 'data/all_data_25HZ'
    os.makedirs(output_root, exist_ok=True)
    for class_name in CLASSES:
        input_class_dir = os.path.join(DATA_DIR, class_name)
        output_class_dir = os.path.join(output_root, class_name)
        os.makedirs(output_class_dir, exist_ok=True)
        for fname in os.listdir(input_class_dir):
            if fname.endswith('.csv'):
                in_path = os.path.join(input_class_dir, fname)
                out_path = os.path.join(output_class_dir, fname)
                df_down = load_and_downsample_csv(in_path, downsample_factor=4)
                df_down.to_csv(out_path, index=False)
    print(f"All files downsampled and copied to {output_root}")

def create_windows(data, window_size):
    windows = []
    for start in range(0, len(data) - window_size + 1, window_size):
        window = data.iloc[start:start+window_size].values
        if window.shape[0] == window_size:
            windows.append(window)
    return windows

def load_dataset():
    X = []
    y = []
    for class_name in CLASSES:
        class_dir = os.path.join(DATA_DIR, class_name)
        for fname in os.listdir(class_dir):
            if fname.endswith('.csv'):
                fpath = os.path.join(class_dir, fname)
                df = load_and_downsample_csv(fpath, downsample_factor=4)  # 100Hz -> 25Hz
                windows = create_windows(df, WINDOW_SIZE)
                X.extend(windows)
                y.extend([class_to_label(class_name)] * len(windows))
    X = np.array(X)
    y = np.array(y)
    return X, y

def build_cnn_model(input_shape, n_classes):
    model = Sequential([
        Conv1D(32, 3, activation='relu', input_shape=input_shape),
        MaxPooling1D(2),
        Conv1D(64, 3, activation='relu'),
        MaxPooling1D(2),
        Flatten(),
        Dense(64, activation='relu'),
        Dropout(0.5),
        Dense(n_classes, activation='softmax')
    ])
    model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
    return model

def main():
    print('Loading and processing data...')
    X, y = load_dataset()
    print(f'Dataset shape: {X.shape}, Labels: {y.shape}')
    y_cat = to_categorical(y, num_classes=len(CLASSES))
    X_train, X_val, y_train, y_val = train_test_split(X, y_cat, test_size=0.2, random_state=42)

    print('Building model...')
    model = build_cnn_model((WINDOW_SIZE, N_CHANNELS), len(CLASSES))
    es = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)
    print('Training...')
    model.fit(X_train, y_train, epochs=30, batch_size=32, validation_data=(X_val, y_val), callbacks=[es])
    model.save('cnn_motion_model.h5')
    print('Model saved as cnn_motion_model.h5')

if __name__ == '__main__':
    downsample_and_copy_all()
    # main()  # Uncomment if you want to run training after downsampling
