from nlp_pipeline import load_nlp

nlp = load_nlp()

print("\nPipeline")
print(nlp.pipe_names)

print()

text = """
Take Paracetamol 500mg twice daily.
Metformin 500mg BD.
Ibuprofen 400mg.
"""

doc = nlp(text)

print("Entities Found\n")

for ent in doc.ents:
    print(
        ent.text,
        "->",
        ent.label_
    )