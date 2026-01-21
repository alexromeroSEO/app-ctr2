import csv

# Leer el CSV y contar keywords con >= 10 clicks
count_gte_10 = 0
count_gt_10 = 0
total_rows = 0

with open(r'c:\Users\aleja\OneDrive\Escritorio\app ctr\Hoja de cálculo sin título - Hoja 1.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        total_rows += 1
        clicks_str = row['Clicks'].replace('.', '').replace(',', '')
        try:
            clicks = int(clicks_str)
            if clicks >= 10:
                count_gte_10 += 1
            if clicks > 10:
                count_gt_10 += 1
        except ValueError:
            print(f"Error parsing clicks: {row['Clicks']}")

print(f"Total de filas: {total_rows}")
print(f"Keywords con >= 10 clicks: {count_gte_10}")
print(f"Keywords con > 10 clicks: {count_gt_10}")
