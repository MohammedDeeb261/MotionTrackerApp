import os
import pandas as pd

INPUT_ROOT = 'data/all_data_1sec'
OUTPUT_ROOT = 'data/all_data_overlap'
WINDOW_SIZE = 100
STEP_SIZE = 50  # 50% overlap: 100 - 50 = 50

os.makedirs(OUTPUT_ROOT, exist_ok=True)

# Dynamically get all activity class folders
CLASSES = [d for d in os.listdir(INPUT_ROOT) if os.path.isdir(os.path.join(INPUT_ROOT, d))]

def process_class(class_name):
    input_class_dir = os.path.join(INPUT_ROOT, class_name)
    output_class_dir = os.path.join(OUTPUT_ROOT, class_name)
    os.makedirs(output_class_dir, exist_ok=True)
    for fname in sorted(os.listdir(input_class_dir)):
        if fname.endswith('.csv'):
            in_path = os.path.join(input_class_dir, fname)
            df = pd.read_csv(in_path, header=None)
            n_rows = len(df)
            window_idx = 1
            for start in range(0, n_rows - WINDOW_SIZE + 1, STEP_SIZE):
                end = start + WINDOW_SIZE
                window_df = df.iloc[start:end]
                if len(window_df) == WINDOW_SIZE:
                    out_fname = f"{os.path.splitext(fname)[0]}_ovl{window_idx}.csv"
                    out_path = os.path.join(output_class_dir, out_fname)
                    window_df.to_csv(out_path, index=False, header=False)
                    window_idx += 1

for class_name in CLASSES:
    process_class(class_name)

print(f"All files processed with 50% overlap and saved in {OUTPUT_ROOT}")
