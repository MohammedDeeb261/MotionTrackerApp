import os
import pandas as pd

INPUT_ROOT = 'data/all_data_1sec'
OUTPUT_ROOT = 'data/all_data_4th_of_sec'
CLASSES = ['walk', 'stand', 'run']
SAMPLES_PER_CHUNK = 25

os.makedirs(OUTPUT_ROOT, exist_ok=True)

for class_name in CLASSES:
    input_class_dir = os.path.join(INPUT_ROOT, class_name)
    output_class_dir = os.path.join(OUTPUT_ROOT, class_name)
    os.makedirs(output_class_dir, exist_ok=True)
    for fname in os.listdir(input_class_dir):
        if fname.endswith('.csv'):
            in_path = os.path.join(input_class_dir, fname)
            df = pd.read_csv(in_path, header=None)
            n_chunks = len(df) // SAMPLES_PER_CHUNK
            # Create a subfolder for each 1-sec file
            base_name = os.path.splitext(fname)[0]
            subfolder = os.path.join(output_class_dir, base_name)
            os.makedirs(subfolder, exist_ok=True)
            for i in range(n_chunks):
                start = i * SAMPLES_PER_CHUNK
                end = start + SAMPLES_PER_CHUNK
                chunk_df = df.iloc[start:end]
                if len(chunk_df) == SAMPLES_PER_CHUNK:
                    out_fname = f"part{i+1}.csv"
                    out_path = os.path.join(subfolder, out_fname)
                    chunk_df.to_csv(out_path, index=False, header=False)
print(f"All 1-second files split into 4 chunks and saved in subfolders in {OUTPUT_ROOT}")
