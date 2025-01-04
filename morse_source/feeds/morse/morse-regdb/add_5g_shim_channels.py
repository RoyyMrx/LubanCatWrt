#!/usr/bin/env python3


import csv
import sys

# Fake 5g channels reported by netlink instead of 1g channels.
# https://docs.google.com/spreadsheets/d/1C0yRhDiEosvEVjZxqhhQ7FWpbjZ3y9tjkV2doaglBFs/edit#gid=361699924
S1G_TO_5G= {
    1: 132,
    2: 134,
    3: 136,
    5: 36,
    6: 38,
    7: 40,
    8: 42,
    9: 44,
    10: 46,
    11: 48,
    12: 50,
    13: 52,
    14: 54,
    15: 56,
    16: 58,
    17: 60,
    18: 62,
    19: 64,
    21: 100,
    22: 102,
    23: 104,
    24: 106,
    25: 108,
    26: 110,
    27: 112,
    28: 114,
    29: 116,
    30: 118,
    31: 120,
    32: 122,
    33: 124,
    34: 126,
    35: 128,
    37: 149,
    38: 151,
    39: 153,
    40: 155,
    41: 157,
    42: 159,
    43: 161,
    44: 163,
    45: 165,
    46: 167,
    47: 169,
    48: 171,
    49: 173,
    50: 175,
    51: 177,
}

# Japanese channels are... different.
JAPAN_S1G_TO_5G = {
    13: 36,
    15: 40,
    17: 44,
    19: 48,
    21: 64,
    2: 38,
    6: 46,
    4: 54,
    8: 62,
    36: 42,
    38: 58,
}


dr = csv.DictReader(sys.stdin)
dw = csv.DictWriter(sys.stdout, dr.fieldnames + ['5g_chan'], lineterminator='\n')
dw.writeheader()
for row in dr:
     m = JAPAN_S1G_TO_5G if row['country_code'] == 'JP' else S1G_TO_5G
     row['5g_chan'] = m.get(int(row['s1g_chan']), 'NA')

     dw.writerow(row)
