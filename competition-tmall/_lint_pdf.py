# -*- coding: utf-8 -*-
"""检测 PDF 视觉行行首的中文禁则标点（复用微信大赛版管线）。"""
import sys

import pymupdf

BAD_LEADING = set('，。、；：？！）】》」』"\'%…—')
doc = pymupdf.open('项目方案.pdf')
issues = []
for pno, page in enumerate(doc, 1):
    d = page.get_text('dict')
    for block in d['blocks']:
        for line in block.get('lines', []):
            text = ''.join(s['text'] for s in line['spans']).strip()
            if text and text[0] in BAD_LEADING:
                issues.append((pno, text[:30]))
doc.close()
for pno, t in issues:
    print(f'第{pno}页 行首标点: {t}')
print('TOTAL:', len(issues))
sys.exit(1 if issues else 0)
