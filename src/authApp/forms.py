from django import forms
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.hashers import check_password

User = get_user_model()


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
    

class UserPasswordUpdateForm(forms.Form):
    current_password = forms.CharField(
        widget=forms.PasswordInput, 
        label="Current Password"
    )
    new_password = forms.CharField(
        widget=forms.PasswordInput, 
        label="New Password"
    )
    confirm_new_password = forms.CharField(
        widget=forms.PasswordInput, 
        label="Confirm New Password"
    )

    def __init__(self, user, *args, **kwargs):
        """
        Takes the currently logged-in user as an argument.
        """
        self.user = user
        super().__init__(*args, **kwargs)

    def clean_current_password(self):
        current_password = self.cleaned_data.get('current_password')
        if not check_password(current_password, self.user.password):
            raise ValidationError("Incorrect current password.")
        return current_password

    def clean(self):
        cleaned_data = super().clean()
        new_password = cleaned_data.get("new_password")
        confirm_new_password = cleaned_data.get("confirm_new_password")

        if new_password and confirm_new_password and new_password != confirm_new_password:
            raise ValidationError("New passwords do not match.")

        return cleaned_data

    def save(self):
        """
        Updates the user's password.
        """
        new_password = self.cleaned_data.get("new_password")
        self.user.set_password(new_password)
        self.user.save()
