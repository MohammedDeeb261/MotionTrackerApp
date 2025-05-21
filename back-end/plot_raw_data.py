import sys
import pandas as pd
import matplotlib.pyplot as plt
import os

# Usage: python plot_raw_data.py <csv_file>
# Example: python plot_raw_data.py data/all_data_1sec/Run/Run_1_sec9_ovl1.csv

def plot_csv(csv_path):
    df = pd.read_csv(csv_path, header=None)
    if df.shape[1] < 6:
        print(f"File {csv_path} does not have at least 6 columns.")
        return
    df = df.iloc[:, [0,1,2,3,4,5]]
    df.columns = ['AccX', 'AccY', 'AccZ', 'GyroX', 'GyroY', 'GyroZ']
    t = range(len(df))
    plt.figure(figsize=(12, 6))
    plt.subplot(2,1,1)
    plt.plot(t, df['AccX'], label='AccX')
    plt.plot(t, df['AccY'], label='AccY')
    plt.plot(t, df['AccZ'], label='AccZ')
    plt.title('Accelerometer')
    plt.ylabel('Acceleration')
    plt.legend()
    plt.subplot(2,1,2)
    plt.plot(t, df['GyroX'], label='GyroX')
    plt.plot(t, df['GyroY'], label='GyroY')
    plt.plot(t, df['GyroZ'], label='GyroZ')
    plt.title('Gyroscope')
    plt.ylabel('Angular Velocity')
    plt.xlabel('Sample (1/100s)')
    plt.legend()
    plt.tight_layout()
    # Save plot as PNG
    png_path = os.path.splitext(csv_path)[0] + '_plot.png'
    plt.savefig(png_path)
    print(f"Saved plot to {png_path}")
    plt.close()

def plot_one_csv_per_activity(base_dir):
    activities = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]
    for activity in activities:
        activity_dir = os.path.join(base_dir, activity)
        csv_files = [f for f in os.listdir(activity_dir) if f.endswith('.csv')]
        if not csv_files:
            print(f"No CSV files found for {activity}")
            continue
        csv_path = os.path.join(activity_dir, csv_files[0])
        df = pd.read_csv(csv_path, header=None)
        if df.shape[1] < 6:
            print(f"File {csv_path} does not have at least 6 columns.")
            continue
        df = df.iloc[:, [0,1,2,3,4,5]]
        df.columns = ['AccX', 'AccY', 'AccZ', 'GyroX', 'GyroY', 'GyroZ']
        t = range(len(df))
        plt.figure(figsize=(12, 6))
        plt.subplot(2,1,1)
        plt.plot(t, df['AccX'], label='AccX')
        plt.plot(t, df['AccY'], label='AccY')
        plt.plot(t, df['AccZ'], label='AccZ')
        plt.title(f'Accelerometer - {activity}')
        plt.ylabel('Acceleration')
        plt.legend()
        plt.subplot(2,1,2)
        plt.plot(t, df['GyroX'], label='GyroX')
        plt.plot(t, df['GyroY'], label='GyroY')
        plt.plot(t, df['GyroZ'], label='GyroZ')
        plt.title(f'Gyroscope - {activity}')
        plt.ylabel('Angular Velocity')
        plt.xlabel('Sample (1/100s)')
        plt.legend()
        plt.tight_layout()
        plt.suptitle(f'Activity: {activity}', y=1.02, fontsize=16)
        # Save plot as PNG in the activity directory
        png_path = os.path.join(activity_dir, f'{activity}_example.png')
        plt.savefig(png_path)
        print(f"Saved plot to {png_path}")
        plt.close()

def plot_overlay_per_activity(base_dir, out_dir):
    activities = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]
    for activity in activities:
        activity_dir = os.path.join(base_dir, activity)
        csv_files = [f for f in os.listdir(activity_dir) if f.endswith('.csv')]
        if len(csv_files) < 1:
            print(f"No CSV files found for {activity}")
            continue
        # Take up to 6 files
        csv_files = csv_files[:6]
        acc_fig, acc_ax = plt.subplots(figsize=(12, 4))
        gyro_fig, gyro_ax = plt.subplots(figsize=(12, 4))
        for i, csv_file in enumerate(csv_files):
            csv_path = os.path.join(activity_dir, csv_file)
            df = pd.read_csv(csv_path, header=None)
            if df.shape[1] < 6:
                print(f"File {csv_path} does not have at least 6 columns.")
                continue
            df = df.iloc[:, [0,1,2,3,4,5]]
            df.columns = ['AccX', 'AccY', 'AccZ', 'GyroX', 'GyroY', 'GyroZ']
            t = range(len(df))
            acc_ax.plot(t, df['AccX'], alpha=0.7, label=f'AccX_{i+1}' if i==0 else None)
            acc_ax.plot(t, df['AccY'], alpha=0.7, label=f'AccY_{i+1}' if i==0 else None)
            acc_ax.plot(t, df['AccZ'], alpha=0.7, label=f'AccZ_{i+1}' if i==0 else None)
            gyro_ax.plot(t, df['GyroX'], alpha=0.7, label=f'GyroX_{i+1}' if i==0 else None)
            gyro_ax.plot(t, df['GyroY'], alpha=0.7, label=f'GyroY_{i+1}' if i==0 else None)
            gyro_ax.plot(t, df['GyroZ'], alpha=0.7, label=f'GyroZ_{i+1}' if i==0 else None)
        acc_ax.set_title(f'Accelerometer - {activity} (6 samples overlay)')
        acc_ax.set_ylabel('Acceleration')
        acc_ax.legend(['AccX', 'AccY', 'AccZ'])
        gyro_ax.set_title(f'Gyroscope - {activity} (6 samples overlay)')
        gyro_ax.set_ylabel('Angular Velocity')
        gyro_ax.set_xlabel('Sample (1/100s)')
        gyro_ax.legend(['GyroX', 'GyroY', 'GyroZ'])
        acc_fig.tight_layout()
        gyro_fig.tight_layout()
        acc_png_path = os.path.join(out_dir, f'{activity}_acc_overlay.png')
        gyro_png_path = os.path.join(out_dir, f'{activity}_gyro_overlay.png')
        acc_fig.savefig(acc_png_path)
        gyro_fig.savefig(gyro_png_path)
        print(f"Saved overlay plots to {acc_png_path} and {gyro_png_path}")
        plt.close(acc_fig)
        plt.close(gyro_fig)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python plot_raw_data.py <csv_file|base_dir>')
        sys.exit(1)
    if os.path.isdir(sys.argv[1]):
        # Save overlays in data/ folder
        plot_overlay_per_activity(sys.argv[1], os.path.join(os.path.dirname(sys.argv[1]), ''))
    else:
        plot_csv(sys.argv[1])
