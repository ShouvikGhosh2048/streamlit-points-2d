import streamlit as st
from streamlit_points_2d import streamlit_points_2d

points = streamlit_points_2d()
# https://discuss.streamlit.io/t/long-text-need-to-adjust-width/800/4
st.write(str(points))