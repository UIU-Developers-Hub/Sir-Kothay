from django import forms
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.contrib.auth.forms import AuthenticationForm


class EmailAuthenticationForm(AuthenticationForm):
    username = forms.EmailField(label="Email", max_length=254)

    def clean_username(self):
        email = self.cleaned_data.get('username')
        
        try:
            user = get_user_model().objects.get(email=email)
        except get_user_model().DoesNotExist:
            raise forms.ValidationError("This email does not exist.")
        
        return email
    

class RegisterForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, label="Password")
    confirm_password = forms.CharField(widget=forms.PasswordInput, label="Confirm Password")
    email = forms.EmailField(label="Email")
    username = forms.CharField(label="Full Name")

    class Meta:
        model = get_user_model()
        fields = ['email', 'username']

    def clean_confirm_password(self):
        password = self.cleaned_data.get('password')
        confirm_password = self.cleaned_data.get('confirm_password')

        if password != confirm_password:
            raise ValidationError("Passwords do not match")

        return confirm_password

    def clean_username(self):
        username = self.cleaned_data.get('username')
        if ' ' in username:
            username = username.replace(' ', '_')
        return username