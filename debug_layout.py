import re
content = open('C:/Users/tahsi/OneDrive - yxrcz/Documents/GitHub/Sir-Kothay/client/index.html', encoding='utf-8').read()
idx = content.find('sk-bottom-nav')
print(content[idx-100 : idx+200])
