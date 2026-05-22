import re

with open('C:/Users/tahsi/OneDrive - yxrcz/Documents/GitHub/Sir-Kothay/client/broadcast/message.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove navigation
content = re.sub(r'<!-- Navigation.*?<\/nav>', '', content, flags=re.DOTALL)
# Remove footer
content = re.sub(r'<!-- Footer.*?<\/footer>', '', content, flags=re.DOTALL)
# Remove mobile nav
content = re.sub(r'<!-- Mobile Bottom Nav.*?<\/nav>', '', content, flags=re.DOTALL)

# Wrap inside sk-app
content = content.replace('<div class="bc-page">', '''<div class="sk-app">
      <!-- Sidebar injected by layout.js -->
      <main class="sk-main">
        <div class="sk-page" style="padding-top: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
          <div class="bc-page" style="min-height: auto; width: 100%;">''')

# Close the new wrappers before API Config
content = content.replace('    </div>\n\n    <!-- API Config -->', '''    </div>
        </div>
      </main>
    </div>

    <!-- API Config -->''')

# Inject layout.js
content = content.replace('<script src="../static/js/theme.js?v=ui-fix-14"></script>', '''<script src="../static/js/theme.js?v=ui-fix-14"></script>
    <script src="../static/js/layout.js?v=ui-fix-30"></script>''')

with open('C:/Users/tahsi/OneDrive - yxrcz/Documents/GitHub/Sir-Kothay/client/broadcast/message.html', 'w', encoding='utf-8') as f:
    f.write(content)
