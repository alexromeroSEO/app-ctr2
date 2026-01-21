import streamlit as st
import csv
import io

st.set_page_config(page_title="Keyword Click Counter", page_icon="📊")

st.title("📊 Keyword Click Counter")
st.markdown("""
Esta herramienta cuenta cuántas palabras clave tienen más de 10 clicks en tu exportación de Google Search Console.
""")

# File uploader
uploaded_file = st.file_uploader("Sube tu archivo CSV de Search Console", type="csv")

if uploaded_file is not None:
    # Leer el CSV
    try:
        content = uploaded_file.getvalue().decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        
        count_gte_10 = 0
        count_gt_10 = 0
        total_rows = 0
        
        for row in reader:
            total_rows += 1
            if 'Clicks' in row:
                clicks_str = row['Clicks'].replace('.', '').replace(',', '')
                try:
                    clicks = int(clicks_str)
                    if clicks >= 10:
                        count_gte_10 += 1
                    if clicks > 10:
                        count_gt_10 += 1
                except ValueError:
                    continue
        
        # Mostrar resultados en Streamlit
        st.divider()
        col1, col2, col3 = st.columns(3)
        col1.metric("Total de filas", total_rows)
        col2.metric("Keywords (>= 10 clicks)", count_gte_10)
        col3.metric("Keywords (> 10 clicks)", count_gt_10)
        
        st.success("¡Análisis completado!")
        
    except Exception as e:
        st.error(f"Error al procesar el archivo: {e}")
else:
    st.info("Por favor, sube un archivo CSV para comenzar.")

