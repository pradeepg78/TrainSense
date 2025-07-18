import requests
import pandas as pd
import numpy as np
import csv
import io
from datetime import datetime, timedelta
from app import db
from app.models.crowd_prediction import CrowdDataPoint
from app.models.transit import Route, Stop

class MTACrowdService:
    """
    Downloads MTA turnstile data and converts to crowd estimates
    Uses smart sampling of about 1000 rows of data
    """
    
    def __init__(self):
        self.mta_turnstile_url = "https://web.mta.info/developers/turnstile.html"
        
        # major stations for pattern learning
        self.priority_stations = [
            'TIMES SQ-42 ST', 'UNION SQ-14 ST', 'HERALD SQ-34 ST',
            'GRAND CENTRAL-42 ST', 'FULTON ST', 'ATLANTIC AV-BARCLAYS',
            '59 ST-COLUMBUS', 'CANAL ST', '42 ST-PORT AUTH', 
            '125 ST', '86 ST', 'ROOSEVELT AV'
        ]
        
        