import os
import pandas as pd

INPUT_ROOT = 'data/all_data'
OUTPUT_ROOT = 'data/all_data_1sec'
CLASSES = ['walk', 'stand', 'run']
SAMPLES_PER_SECOND = 100

os.makedirs(OUTPUT_ROOT, exist_ok=True)

for class_name in CLASSES:
    input_class_dir = os.path.join(INPUT_ROOT, class_name)
    output_class_dir = os.path.join(OUTPUT_ROOT, class_name)
    os.makedirs(output_class_dir, exist_ok=True)
    for fname in os.listdir(input_class_dir):
        if fname.endswith('.csv'):
            in_path = os.path.join(input_class_dir, fname)
            df = pd.read_csv(in_path, header=None)
            n_windows = len(df) // SAMPLES_PER_SECOND
            for i in range(n_windows):
                start = i * SAMPLES_PER_SECOND
                end = start + SAMPLES_PER_SECOND
                window_df = df.iloc[start:end]
                if len(window_df) == SAMPLES_PER_SECOND:
                    out_fname = f"{os.path.splitext(fname)[0]}_sec{i+1}.csv"
                    out_path = os.path.join(output_class_dir, out_fname)
                    window_df.to_csv(out_path, index=False, header=False)
print(f"All files split into 1-second segments and saved in {OUTPUT_ROOT}")
