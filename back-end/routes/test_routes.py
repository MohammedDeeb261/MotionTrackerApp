from flask import Blueprint, jsonify
from evaluate_model import evaluate_model
import matplotlib.pyplot as plt
import os

# Define the blueprint for test routes
test_routes = Blueprint('test_routes', __name__)

@test_routes.route("/", methods=["GET"])
def test_model():
    try:
        # Dynamically use the testing_windows directory
        data_dir = os.path.join(os.getcwd(), "testing_windows")
        result = evaluate_model(data_dir)

        # Generate a bar chart for the results
        activities = list(result.keys())
        passed = [result[activity]["passed"] for activity in activities]
        total = [result[activity]["total"] for activity in activities]

        x = range(len(activities))
        plt.bar(x, total, color='lightgray', label='Total')
        plt.bar(x, passed, color='green', label='Passed')
        plt.xticks(x, activities)
        plt.xlabel('Activities')
        plt.ylabel('Number of Files')
        plt.title('Testing Results')
        plt.legend()

        # Add text annotations for passed counts only
        for i, activity in enumerate(activities):
            plt.text(i, total[i], f"Passed: {passed[i]}/{total[i]}", ha='center', va='bottom', fontsize=9, color='black')

        # Add text annotations for accuracy percentage
        for i, activity in enumerate(activities):
            accuracy = (passed[i] / total[i]) * 100 if total[i] > 0 else 0
            plt.text(i, total[i], f"Accuracy: {accuracy:.2f}%", ha='center', va='top', fontsize=9, color='blue')

        # Save the graph as an image
        graph_path = os.path.join(os.getcwd(), "testing_results.png")
        plt.savefig(graph_path)
        plt.close()

        # Prepare pass and fail summary
        summary = {
            activity: {
                "passed": result[activity]["passed"],
                "failed": result[activity]["total"] - result[activity]["passed"]
            } for activity in activities
        }

        return jsonify({"message": "Testing completed. Graph saved.", "graph_path": graph_path, "summary": summary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500