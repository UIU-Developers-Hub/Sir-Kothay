import qrcode
from PIL import Image
from django.contrib import messages
from django.shortcuts import render, redirect
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.staticfiles import finders
from io import BytesIO
from django.conf import settings
from django.contrib.auth.decorators import login_required
from .models import QRCode
from django.urls import reverse


@login_required
def generate_qr_code_with_logo(request):
    # Check if the user already has a QR code
    if QRCode.objects.filter(user=request.user).exists():
        messages.info(request, "You already have your one-time QR code.")
        return redirect(reverse('home'))
    
    # Build the URL using the URL name
    url_to_encode = request.build_absolute_uri(reverse('home'))

    # Generate the QR code
    qr = qrcode.QRCode(
        version=1,  # controls the size of the QR Code
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction for logo insertion
        box_size=10,
        border=4,
    )
    qr.add_data(url_to_encode)
    qr.make(fit=True)

    # Create an image from the QR code
    img = qr.make_image(fill='black', back_color='white').convert("RGBA")  # Convert to RGBA for transparency support

    # Open the logo image
    logo_path = finders.find('images/logo.png')
    if logo_path:
        logo = Image.open(logo_path).convert("RGBA")  # Ensure the logo has an alpha channel

        # Calculate the size of the logo and resize it
        qr_width, qr_height = img.size
        logo = logo.resize((90, 60), Image.LANCZOS)

        # Create a transparent layer the same size as the QR code
        overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
        logo_position = ((qr_width - 90) // 2, (qr_height - 60) // 2)

        # Paste the logo onto the overlay
        overlay.paste(logo, logo_position, logo)

        # Merge QR code and logo overlay
        img = Image.alpha_composite(img, overlay)

    # Save the image to a BytesIO buffer
    img_buffer = BytesIO()
    img.save(img_buffer, format='PNG')
    img_buffer.seek(0)

    # Create a SimpleUploadedFile to save the image
    qr_image = SimpleUploadedFile(
        name="qr_code_with_logo.png",
        content=img_buffer.read(),
        content_type='image/png'
    )

    # Create or update the QRCode object in the database
    qr_code, created = QRCode.objects.get_or_create(user=request.user)
    qr_code.image.save(qr_image.name, qr_image)
    qr_code.save()
    
    messages.success(request, "QR Code with logo generated successfully!")

    return redirect(reverse('home'))
