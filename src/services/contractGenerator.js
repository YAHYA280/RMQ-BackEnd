// src/services/contractGenerator.js - Using Precise Coordinates from Photoshop
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

class ContractGenerator {
  constructor() {
    this.templatePath = path.join(__dirname, "../assets/contract-template.jpg");
    // Exact template dimensions you provided
    this.imageWidth = 1414; // Template width in pixels
    this.imageHeight = 2000; // Template height in pixels
  }

  async generateContract(bookingData) {
    return new Promise((resolve, reject) => {
      try {
        console.log(
          "Generating contract with precise coordinates for:",
          bookingData.bookingNumber
        );

        if (!this.validateBookingData(bookingData)) {
          throw new Error("Invalid booking data provided");
        }

        // Check if template image exists
        if (!fs.existsSync(this.templatePath)) {
          throw new Error(`Template image not found at: ${this.templatePath}`);
        }

        const doc = new PDFDocument({
          size: "A4",
          margin: 0,
          info: {
            Title: `Contract ${bookingData.bookingNumber}`,
            Author: "MELHOR QUE NADA CARS",
            Subject: "Car Rental Contract",
            CreationDate: new Date(),
          },
        });

        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));

        // Add the background template image
        doc.image(this.templatePath, 0, 0, {
          width: doc.page.width,
          height: doc.page.height,
        });

        // Overlay the data using your precise coordinates
        this.overlayDataWithCoordinates(doc, bookingData);

        doc.end();
      } catch (error) {
        console.error("PDF generation error:", error);
        reject(error);
      }
    });
  }

  validateBookingData(bookingData) {
    return (
      bookingData &&
      bookingData.customer &&
      bookingData.vehicle &&
      bookingData.bookingNumber
    );
  }

  // Convert Photoshop Y coordinate to PDF Y coordinate
  convertY(photoshopY) {
    return this.imageHeight - photoshopY;
  }

  // Scale coordinates from image pixels to PDF points
  scaleCoordinate(imageCoord, imageDimension, pdfDimension) {
    return (imageCoord * pdfDimension) / imageDimension;
  }

  overlayDataWithCoordinates(doc, bookingData) {
    // Set default text properties with better font and larger size
    doc.fillColor("#000000");
    doc.fontSize(12); // Reduced from 35 to better fit the fields
    doc.font("Helvetica-Bold"); // Using bold Helvetica for better clarity

    // Calculate scaling factors based on A4 PDF size
    const pdfWidth = doc.page.width; // ~595 points for A4
    const pdfHeight = doc.page.height; // ~842 points for A4

    // Scale factors to convert your image coordinates to PDF coordinates
    const scaleX = pdfWidth / this.imageWidth; // Convert image X to PDF X
    const scaleY = pdfHeight / this.imageHeight; // Convert image Y to PDF Y

    // Helper function to place text at scaled coordinates
    const placeText = (text, x, y, fontSize = 12, maxWidth = null) => {
      if (!text) return;

      // Convert image coordinates to PDF coordinates
      const pdfX = x * scaleX;
      const pdfY = pdfHeight - y * scaleY; // Flip Y coordinate (image top-left to PDF bottom-left)

      doc.fontSize(fontSize);
      doc.font("Helvetica-Bold");

      if (maxWidth) {
        const scaledWidth = maxWidth * scaleX;
        doc.text(text, pdfX, pdfY, { width: scaledWidth, ellipsis: true });
      } else {
        doc.text(text, pdfX, pdfY);
      }

      console.log(
        `Placed "${text}" at PDF coordinates: (${pdfX.toFixed(
          1
        )}, ${pdfY.toFixed(1)})`
      );
    };

    // Contract Number (adjust position - it should be red and in top right)
    doc.fillColor("#ff0000"); // Red color for contract number
    placeText(bookingData.bookingNumber, 1150, 1900, 14);
    doc.fillColor("#000000"); // Back to black for other text

    // Customer Information Fields (converting from your image coordinates to PDF coordinates)

    // Nom et Prénom: [350, 446] on 1414x2000 image
    const customerName = `${bookingData.customer.firstName || ""} ${
      bookingData.customer.lastName || ""
    }`;
    placeText(customerName, 350, 1565, 10);

    // Nationalité: [310, 502]
    placeText(bookingData.customer.country || "Marocaine", 310, 1506, 10);

    // Date de Naissance: [412, 557]
    if (bookingData.customer.dateOfBirth) {
      const dob = new Date(bookingData.customer.dateOfBirth).toLocaleDateString(
        "fr-FR"
      );
      placeText(dob, 412, 1410, 10);
    }

    // Passport N°: [310, 615]
    placeText(
      bookingData.customer.passportNumber || "passportNUmber",
      310,
      1395,
      10
    );

    // Délivré à: [278, 671]
    placeText(bookingData.customer.passportIssuedAt || "", 278, 671, 10);

    // CIN: [300, 725]
    placeText(bookingData.customer.cinNumber || "", 300, 725, 10);

    // Permis de conduite N°: [420, 780]
    placeText(bookingData.customer.driverLicenseNumber || "", 420, 780, 10);

    // Adresse: [160, 940]
    placeText(bookingData.customer.address || "", 160, 940, 10);

    // Numéro de téléphone: [250, 1000]
    placeText(bookingData.customer.phone || "", 250, 1000, 10);

    // Vehicle Information Fields (adjusting to fit better in the right-side form fields)

    // Marque de véhicule: adjusting to fit in the field better
    const vehicleName = `${bookingData.vehicle.brand || ""} ${
      bookingData.vehicle.name || ""
    }`;
    placeText(vehicleName, 1160, 1630, 9);

    // Immatriculation: adjusting position
    placeText(bookingData.vehicle.licensePlate || "", 1180, 1560, 9);

    // Date de départ: adjusting position
    if (bookingData.pickupDate) {
      const pickupDate = new Date(bookingData.pickupDate).toLocaleDateString(
        "fr-FR"
      );
      placeText(pickupDate, 1180, 1480, 9);
    }

    // Date de retour: adjusting position
    if (bookingData.returnDate) {
      const returnDate = new Date(bookingData.returnDate).toLocaleDateString(
        "fr-FR"
      );
      placeText(returnDate, 1180, 1410, 9);
    }

    // Nombre de jours: adjusting position
    placeText(bookingData.totalDays?.toString() || "0", 1200, 1340, 9);

    // Heure de départ: adjusting position
    placeText(bookingData.pickupTime || "", 1180, 1270, 9);

    // Heure de retour: adjusting position
    placeText(bookingData.returnTime || "", 1180, 1130, 9);

    // Montant: positioning to fit in the Montant field
    placeText(`${bookingData.totalAmount || 0} DH`, 1160, 1060, 9);

    // // Kilométrage: positioning to fit in the Kilométrage field
    // placeText(bookingData.vehicle.mileage?.toString() || "0", 1160, 1058, 9);

    console.log(
      "Contract data overlayed with corrected coordinates and scaling"
    );
  }
}

module.exports = ContractGenerator;
