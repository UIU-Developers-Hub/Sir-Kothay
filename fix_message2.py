import re

with open('C:/Users/tahsi/OneDrive - yxrcz/Documents/GitHub/Sir-Kothay/client/broadcast/message.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert bottom nav before the closing tag of sk-app
# The closing tags are:
#         </div>
#       </main>
#     </div>
#
#     <!-- API Config -->
bottom_nav = '''
      <!-- Mobile Bottom Nav -->
      <nav class="sk-bottom-nav">
        <div class="sk-bottom-nav-items">
          <!-- Injected by JS -->
        </div>
      </nav>
    </div>

    <!-- API Config -->'''

content = content.replace('    </div>\n\n    <!-- API Config -->', bottom_nav)

# 2. Add SKLayout.setupPublicNav call
setup_script = '''<script src="../static/js/layout.js?v=ui-fix-30"></script>
    <script>
      SKLayout.setupPublicNav && SKLayout.setupPublicNav('broadcast');
    </script>'''

content = content.replace('<script src="../static/js/layout.js?v=ui-fix-30"></script>', setup_script)

with open('C:/Users/tahsi/OneDrive - yxrcz/Documents/GitHub/Sir-Kothay/client/broadcast/message.html', 'w', encoding='utf-8') as f:
    f.write(content)
