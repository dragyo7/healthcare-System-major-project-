import os
import win32com.client

input_path = os.path.abspath('docs/Complete_Healthcare_CDS_Research_Paper_Final_v2.10.docx')
output_path = os.path.abspath('docs/Complete_Healthcare_CDS_Research_Paper_Final_v2.10.pdf')

print(f"Converting:\n  Input: {input_path}\n  Output: {output_path}")

word = win32com.client.Dispatch('Word.Application')
word.Visible = False

try:
    doc = word.Documents.Open(input_path)
    # Format 17 is wdFormatPDF
    doc.SaveAs(output_path, FileFormat=17)
    doc.Close()
    print("PDF export successful!")
finally:
    word.Quit()

if os.path.exists(output_path):
    print(f"PDF verified exists: {output_path} ({os.path.getsize(output_path)} bytes)")
else:
    print("PDF conversion failed, file does not exist.")
