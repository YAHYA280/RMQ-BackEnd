// src/services/contractGenerator.js - UPDATED: Using all new customer fields
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
          "Generating contract with all customer fields for:",
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
            Title: `Contrat ${bookingData.bookingNumber}`,
            Author: "MELHOR QUE NADA CARS",
            Subject: "Contrat de Location de Voiture",
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

        // Overlay the data using your precise coordinates with all new fields
        this.overlayDataWithAllFields(doc, bookingData);

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

  // UPDATED: Enhanced data overlay with all new customer fields
  overlayDataWithAllFields(doc, bookingData) {
    // Set default text properties with better font and larger size
    doc.fillColor("#000000");
    doc.fontSize(12);
    doc.font("Helvetica-Bold");

    // Calculate scaling factors based on A4 PDF size
    const pdfWidth = doc.page.width; // ~595 points for A4
    const pdfHeight = doc.page.height; // ~842 points for A4

    // Scale factors to convert your image coordinates to PDF coordinates
    const scaleX = pdfWidth / this.imageWidth;
    const scaleY = pdfHeight / this.imageHeight;

    // Helper function to place text at scaled coordinates
    const placeText = (text, x, y, fontSize = 12, maxWidth = null) => {
      if (!text) return;

      // Convert image coordinates to PDF coordinates
      const pdfX = x * scaleX;
      const pdfY = pdfHeight - y * scaleY;

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

    // Helper function to format date in French
    const formatDateFrench = (dateString) => {
      if (!dateString) return "";
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } catch {
        return dateString;
      }
    };

    // Helper function to get customer's age
    const getCustomerAge = (customer) => {
      if (!customer.dateOfBirth) return "";
      try {
        const birthDate = new Date(customer.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
        return age.toString();
      } catch {
        return "";
      }
    };

    // Contract number (in red)
    doc.fillColor("#ff0000");
    placeText(bookingData.bookingNumber, 1150, 1900, 14);
    doc.fillColor("#000000");

    // Customer Information Section
    const customer = bookingData.customer;

    // Nom et Prénom: [350, 1565]
    const customerName = `${customer.firstName || ""} ${
      customer.lastName || ""
    }`;
    placeText(customerName, 350, 1565, 10);

    // UPDATED: Nationalité: [310, 1506] - Use customer's country or default to Marocaine
    const nationality =
      this.getCountryNationality(customer.country) || "Marocaine";
    placeText(nationality, 310, 1506, 10);

    // UPDATED: Date de Naissance: [412, 1410] - Use new dateOfBirth field
    if (customer.dateOfBirth) {
      const dob = formatDateFrench(customer.dateOfBirth);
      placeText(dob, 412, 1410, 10);
    }

    // UPDATED: Passport N°: [310, 1395] - Use new passportNumber field
    if (customer.passportNumber) {
      placeText(customer.passportNumber, 310, 1395, 10);
    }

    // UPDATED: Délivré à: [278, 1325] - Use new passportIssuedAt field
    if (customer.passportIssuedAt) {
      placeText(customer.passportIssuedAt, 278, 1325, 10);
    }

    // UPDATED: CIN: [300, 1255] - Use new cinNumber field
    if (customer.cinNumber) {
      placeText(customer.cinNumber, 300, 1255, 10);
    }

    // UPDATED: Permis de conduite N°: [420, 1185] - Use enhanced driverLicenseNumber field
    if (customer.driverLicenseNumber) {
      placeText(customer.driverLicenseNumber, 420, 1185, 10);
    }

    // UPDATED: Adresse: [160, 1115] - Use enhanced address field (now supports 500 chars)
    if (customer.address) {
      // For longer addresses, we might need to wrap text or use smaller font
      let addressText = customer.address;
      if (customer.city) {
        addressText += `, ${customer.city}`;
      }
      if (customer.postalCode) {
        addressText += ` ${customer.postalCode}`;
      }

      // Use smaller font for longer addresses
      const fontSize = addressText.length > 50 ? 8 : 10;
      placeText(addressText, 160, 1115, fontSize, 400); // Max width of 400 pixels
    }

    // UPDATED: Numéro de téléphone: [250, 1045] - Enhanced phone formatting
    if (customer.phone) {
      // Format phone number for display
      const formattedPhone = this.formatPhoneNumber(customer.phone);
      placeText(formattedPhone, 250, 1045, 10);
    }

    // NEW: Age (if needed elsewhere on the contract)
    const customerAge = getCustomerAge(customer);
    if (customerAge) {
      // You can place age somewhere if needed on your template
      // placeText(`${customerAge} ans`, x, y, 10);
    }

    // Vehicle Information Fields
    const vehicle = bookingData.vehicle;

    // Marque de véhicule: [1160, 1630]
    const vehicleName = `${vehicle.brand || ""} ${vehicle.name || ""}`;
    placeText(vehicleName, 1160, 1630, 9);

    // Immatriculation: [1180, 1560]
    placeText(vehicle.licensePlate || "", 1180, 1560, 9);

    // Date de départ: [1180, 1480]
    if (bookingData.pickupDate) {
      const pickupDate = formatDateFrench(bookingData.pickupDate);
      placeText(pickupDate, 1180, 1480, 9);
    }

    // Date de retour: [1180, 1410]
    if (bookingData.returnDate) {
      const returnDate = formatDateFrench(bookingData.returnDate);
      placeText(returnDate, 1180, 1410, 9);
    }

    // Nombre de jours: [1200, 1340]
    placeText(bookingData.totalDays?.toString() || "0", 1200, 1340, 9);

    // Heure de départ: [1180, 1270]
    placeText(bookingData.pickupTime || "", 1180, 1270, 9);

    // Heure de retour: [1180, 1130]
    placeText(bookingData.returnTime || "", 1180, 1130, 9);

    // Montant: [1160, 1060]
    placeText(`${bookingData.totalAmount || 0} DH`, 1160, 1060, 9);

    // NEW: Additional fields that might be useful

    // If you have space for emergency contact
    if (customer.emergencyContact && customer.emergencyContact.name) {
      // placeText(`Contact d'urgence: ${customer.emergencyContact.name}`, x, y, 8);
    }

    // If you want to show document verification status
    const hasCompleteDocuments = !!(
      customer.driverLicenseNumber &&
      customer.passportNumber &&
      customer.cinNumber &&
      customer.dateOfBirth &&
      customer.address
    );

    // You could add a small indicator if documents are complete
    if (hasCompleteDocuments) {
      // placeText("✓ Documents complets", x, y, 8);
    }

    console.log(
      "Contract data overlayed with all customer fields and enhanced information"
    );
  }

  // NEW: Helper function to get nationality from country code
  getCountryNationality(countryCode) {
    const nationalityMap = {
      MA: "Marocaine",
      FR: "Française",
      ES: "Espagnole",
      DE: "Allemande",
      IT: "Italienne",
      GB: "Britannique",
      US: "Américaine",
      CA: "Canadienne",
      DZ: "Algérienne",
      TN: "Tunisienne",
      BE: "Belge",
      NL: "Néerlandaise",
      PT: "Portugaise",
    };

    return nationalityMap[countryCode] || null;
  }

  // NEW: Helper function to format phone number for contract display
  formatPhoneNumber(phone) {
    if (!phone) return "";

    // Remove any existing formatting
    const cleaned = phone.replace(/\s/g, "");

    // Format Moroccan numbers: 0612345678 → 06 12 34 56 78
    if (
      cleaned.length === 10 &&
      (cleaned.startsWith("06") || cleaned.startsWith("07"))
    ) {
      return `${cleaned.substring(0, 2)} ${cleaned.substring(
        2,
        4
      )} ${cleaned.substring(4, 6)} ${cleaned.substring(
        6,
        8
      )} ${cleaned.substring(8, 10)}`;
    }

    // Return original if not standard format
    return phone;
  }

  // NEW: Validate that customer has required information for contract
  validateCustomerInfo(customer) {
    const requiredFields = ["firstName", "lastName", "phone"];
    const missingFields = [];

    requiredFields.forEach((field) => {
      if (!customer[field]) {
        missingFields.push(field);
      }
    });

    // Check for at least one identity document
    const hasIdentityDoc = !!(
      customer.passportNumber ||
      customer.cinNumber ||
      customer.driverLicenseNumber
    );

    if (!hasIdentityDoc) {
      missingFields.push("identity_document");
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
      completionScore: this.calculateCompletionScore(customer),
    };
  }

  // NEW: Calculate how complete the customer information is (0-100%)
  calculateCompletionScore(customer) {
    const fields = [
      customer.firstName,
      customer.lastName,
      customer.phone,
      customer.email,
      customer.dateOfBirth,
      customer.address,
      customer.driverLicenseNumber,
      customer.passportNumber,
      customer.cinNumber,
      customer.passportIssuedAt,
    ];

    const completedFields = fields.filter(
      (field) => field && field.toString().trim() !== ""
    ).length;
    return Math.round((completedFields / fields.length) * 100);
  }

  // NEW: Generate contract with validation
  async generateContractWithValidation(bookingData) {
    const validation = this.validateCustomerInfo(bookingData.customer);

    if (!validation.isValid) {
      console.warn("Contract generated with incomplete customer information:", {
        missingFields: validation.missingFields,
        completionScore: validation.completionScore,
      });
    }

    return this.generateContract(bookingData);
  }

  // NEW: Get missing customer information for UI display
  getMissingCustomerInfo(customer) {
    const allFields = {
      Prénom: customer.firstName,
      Nom: customer.lastName,
      Téléphone: customer.phone,
      Email: customer.email,
      "Date de naissance": customer.dateOfBirth,
      Adresse: customer.address,
      "Numéro de permis de conduire": customer.driverLicenseNumber,
      "Numéro de passeport": customer.passportNumber,
      "Numéro CIN": customer.cinNumber,
      "Passeport délivré à": customer.passportIssuedAt,
    };

    const missingFields = Object.entries(allFields)
      .filter(([key, value]) => !value || value.toString().trim() === "")
      .map(([key]) => key);

    return {
      missingFields,
      hasRequiredFields: !!(
        customer.firstName &&
        customer.lastName &&
        customer.phone
      ),
      hasAnyIdentityDocument: !!(
        customer.passportNumber ||
        customer.cinNumber ||
        customer.driverLicenseNumber
      ),
      completionPercentage: this.calculateCompletionScore(customer),
    };
  }
}

module.exports = ContractGenerator;
