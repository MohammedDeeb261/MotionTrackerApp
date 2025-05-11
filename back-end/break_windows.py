import pandas as pd
import os

def split_csv_into_windows(input_file, output_dir, rows_per_window=100):
    """
    Splits a CSV file into smaller windows of data and saves each window into its own file.

    Parameters:
        input_file (str): Path to the input CSV file.
        output_dir (str): Directory where the output files will be saved.
        rows_per_window (int): Number of rows per window (default is 100).
    """
    # Read the input CSV file
    data = pd.read_csv(input_file)
    
    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Calculate the number of windows
    num_windows = len(data) // rows_per_window
    
    # Split the data into windows
    for i in range(num_windows):
        # Extract the rows for the current window
        start_row = i * rows_per_window
        end_row = start_row + rows_per_window
        window_data = data.iloc[start_row:end_row]
        
        # Save the window to a new CSV file
        output_file = os.path.join(output_dir, f"window_{i+1}.csv")
        window_data.to_csv(output_file, index=False)
        print(f"Saved: {output_file}")

def process_all_files_in_directory(input_dir, output_dir, rows_per_window=100):
    """
    Processes all CSV files in a directory, splitting them into smaller windows.

    Parameters:
        input_dir (str): Path to the directory containing input CSV files.
        output_dir (str): Path to the directory where output files will be saved.
        rows_per_window (int): Number of rows per window (default is 100).
    """
    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Iterate over all files in the input directory
    for filename in os.listdir(input_dir):
        if filename.endswith(".csv"):
            input_file = os.path.join(input_dir, filename)
            file_output_dir = os.path.join(output_dir, os.path.splitext(filename)[0])
            os.makedirs(file_output_dir, exist_ok=True)
            split_csv_into_windows(input_file, file_output_dir, rows_per_window)

# Example usage
# Input directories
training_dir = "dataset"
testing_dir = "test_dataset"

# Output directories
training_output_dir = "training_windows"
testing_output_dir = "testing_windows"

# Process all files in the training and testing directories
# Assuming 100 rows per second, 3 seconds would be 300 rows per window
process_all_files_in_directory(training_dir, training_output_dir, rows_per_window=300)
process_all_files_in_directory(testing_dir, testing_output_dir, rows_per_window=300)