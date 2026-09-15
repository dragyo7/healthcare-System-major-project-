from extractor import analyze_prescription

sample = """
Take Paracetamol 500mg orally twice daily after meals for 5 days.

Metformin 500mg BD after breakfast.

Ibuprofen 400mg every 8 hours before meals.
"""

result = analyze_prescription(sample)

from pprint import pprint
pprint(result)