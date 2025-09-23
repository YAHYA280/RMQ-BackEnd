const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

class ContractGenerator {
  constructor() {
    this.templatePath = path.join(__dirname, "../assets/contract-template.jpg");
    this.imageWidth = 1414; // Template width in pixels
    this.imageHeight = 2000; // Template height in pixels
  }

  async generateContract(bookingData) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.validateBookingData(bookingData)) {
          console.error("Invalid booking data:", {
            hasBooking: !!bookingData,
            hasCustomer: !!bookingData?.customer,
            hasVehicle: !!bookingData?.vehicle,
            hasBookingNumber: !!bookingData?.bookingNumber,
          });
          throw new Error("Invalid booking data provided");
        }

        if (!fs.existsSync(this.templatePath)) {
          console.error(`Template image not found at: ${this.templatePath}`);
          return this.generateSimplePDF(bookingData, resolve, reject);
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
        doc.on("end", () => {
          console.log(
            `Contract PDF generated successfully for ${bookingData.bookingNumber}`
          );
          resolve(Buffer.concat(chunks));
        });
        doc.on("error", (err) => {
          console.error("PDF generation error:", err);
          reject(err);
        });

        // Add the background template image
        try {
          doc.image(this.templatePath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
          });
        } catch (imageError) {
          console.error("Error loading template image:", imageError);
          // Continue without template
        }

        // Overlay the data using simplified customer structure
        this.overlayDataWithSimplifiedFields(doc, bookingData);

        doc.end();
      } catch (error) {
        console.error("PDF generation error:", error);
        reject(error);
      }
    });
  }

  generateSimplePDF(bookingData, resolve, reject) {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Contrat ${bookingData.bookingNumber}`,
          Author: "MELHOR QUE NADA CARS",
          Subject: "Contrat de Location de Voiture",
          CreationDate: new Date(),
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", (err) => {
        reject(err);
      });
      this.generateSimpleContractContent(doc, bookingData);
      doc.end();
    } catch (error) {
      reject(error);
    }
  }

  generateSimpleContractContent(doc, bookingData) {
    const customer = bookingData.customer;
    const vehicle = bookingData.vehicle;

    // Title
    doc.fontSize(20).font("Helvetica-Bold");
    doc.text("CONTRAT DE LOCATION DE VOITURE", 50, 50, { align: "center" });

    // Contract number
    doc.fontSize(14).fillColor("red");
    doc.text(`Contrat N°: ${bookingData.bookingNumber}`, 400, 80);

    doc.fillColor("black").fontSize(12).font("Helvetica");

    // Customer section
    doc.text("INFORMATIONS CLIENT:", 50, 150);
    doc.fontSize(10);
    doc.text(`Nom: ${customer.firstName} ${customer.lastName}`, 50, 170);
    doc.text(`Téléphone: ${customer.phone}`, 50, 185);
    if (customer.email) doc.text(`Email: ${customer.email}`, 50, 200);
    if (customer.address) doc.text(`Adresse: ${customer.address}`, 50, 215);
    if (customer.dateOfBirth)
      doc.text(`Date de naissance: ${customer.dateOfBirth}`, 50, 230);
    if (customer.driverLicenseNumber)
      doc.text(`Permis N°: ${customer.driverLicenseNumber}`, 50, 245);
    if (customer.passportNumber)
      doc.text(`Passeport N°: ${customer.passportNumber}`, 50, 260);
    if (customer.cinNumber) doc.text(`CIN N°: ${customer.cinNumber}`, 50, 275);

    // Vehicle section
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("INFORMATIONS VÉHICULE:", 50, 310);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Véhicule: ${vehicle.brand} ${vehicle.name}`, 50, 330);
    doc.text(`Année: ${vehicle.year}`, 50, 345);
    doc.text(`Plaque: ${vehicle.licensePlate}`, 50, 360);
    doc.text(`Prix journalier: ${bookingData.dailyRate} €`, 50, 370);

    // Booking details
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("DÉTAILS DE LA LOCATION:", 50, 410);
    doc.fontSize(10).font("Helvetica");
    doc.text(
      `Date de départ: ${bookingData.pickupDate} à ${bookingData.pickupTime}`,
      50,
      430
    );
    doc.text(
      `Date de retour: ${bookingData.returnDate} à ${bookingData.returnTime}`,
      50,
      445
    );
    doc.text(`Lieu de départ: ${bookingData.pickupLocation}`, 50, 460);
    doc.text(`Lieu de retour: ${bookingData.returnLocation}`, 50, 475);
    doc.text(`Durée: ${bookingData.totalDays} jour(s)`, 50, 490);

    // Total
    doc.fontSize(14).font("Helvetica-Bold");
    doc.text(`MONTANT TOTAL: ${bookingData.totalAmount} €`, 50, 520);

    // Signature section
    doc.fontSize(10).font("Helvetica");
    doc.text("Signature du client:", 50, 650);
    doc.text("Date et lieu:", 300, 650);

    doc.text("Signature de l'agence:", 50, 700);
    doc.text("Cachet de l'entreprise:", 300, 700);
  }

  validateBookingData(bookingData) {
    if (!bookingData) {
      console.error("No booking data provided");
      return false;
    }

    if (!bookingData.customer) {
      console.error("No customer data in booking");
      return false;
    }

    if (!bookingData.vehicle) {
      console.error("No vehicle data in booking");
      return false;
    }

    if (!bookingData.bookingNumber) {
      console.error("No booking number provided");
      return false;
    }

    if (!bookingData.customer.firstName || !bookingData.customer.lastName) {
      console.error("Customer missing name information");
      return false;
    }

    return true;
  }

  convertY(photoshopY) {
    return this.imageHeight - photoshopY;
  }

  // Scale coordinates from image pixels to PDF points
  scaleCoordinate(imageCoord, imageDimension, pdfDimension) {
    return (imageCoord * pdfDimension) / imageDimension;
  }

  overlayDataWithSimplifiedFields(doc, bookingData) {
    try {
      doc.fillColor("#000000");
      doc.fontSize(12);
      doc.font("Helvetica-Bold");

      const pdfWidth = doc.page.width;
      const pdfHeight = doc.page.height;

      const scaleX = pdfWidth / this.imageWidth;
      const scaleY = pdfHeight / this.imageHeight;

      const placeText = (text, x, y, fontSize = 12, maxWidth = null) => {
        if (!text) return;

        try {
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
        } catch (textError) {
          console.error(`Error placing text "${text}":`, textError);
        }
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

      // Customer Information Section (simplified)
      const customer = bookingData.customer;

      // Nom et Prénom: [350, 1565]
      const customerName = `${customer.firstName || ""} ${
        customer.lastName || ""
      }`;
      placeText(customerName, 350, 1565, 10);

      // Nationalité: [310, 1506] - Use customer's country or default to Marocaine
      const nationality =
        this.getCountryNationality(customer.country) || "Marocaine";
      placeText(nationality, 310, 1506, 10);

      // Date de Naissance: [412, 1410] - Use dateOfBirth field
      if (customer.dateOfBirth) {
        const dob = formatDateFrench(customer.dateOfBirth);
        placeText(dob, 412, 1450, 10);
      }

      // Passport N°: [310, 1395] - Use passportNumber field
      if (customer.passportNumber) {
        placeText(customer.passportNumber, 365, 1395, 10);
      }

      // Délivré à: [278, 1325] - Use passportIssuedAt field
      if (customer.passportIssuedAt) {
        placeText(customer.passportIssuedAt, 350, 1340, 10);
      }

      // CIN: [300, 1255] - Use cinNumber field
      if (customer.cinNumber) {
        placeText(customer.cinNumber, 300, 1285, 10);
      }

      // Permis de conduite N°: [420, 1185] - Use driverLicenseNumber field
      if (customer.driverLicenseNumber) {
        placeText(customer.driverLicenseNumber, 440, 1225, 10);
      }

      // UPDATED: Adresse: [160, 1115] - Use simplified address field
      if (customer.address) {
        // Parse the address to extract city information if possible
        let addressText = customer.address;

        // For display purposes, we can try to intelligently parse the address
        // Since it's now a single field, we display it as-is but with formatting consideration
        const fontSize = addressText.length > 50 ? 8 : 10;
        placeText(addressText, 160, 1065, fontSize, 400); // Max width of 400 pixels
      }

      // Numéro de téléphone: [250, 1045] - Enhanced phone formatting
      if (customer.phone) {
        // Format phone number for display
        const formattedPhone = this.formatPhoneNumber(customer.phone);
        placeText(formattedPhone, 350, 1005, 10);
      }

      // Vehicle Information Fields (unchanged)
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
      placeText(`${bookingData.totalAmount || 0} €`, 1180, 1050, 9);

      // Additional information display
      const hasCompleteDocuments = !!(
        customer.driverLicenseNumber &&
        customer.passportNumber &&
        customer.cinNumber &&
        customer.dateOfBirth &&
        customer.address
      );

      console.log(
        "Contract data overlayed with simplified customer structure:",
        {
          customerName,
          nationality,
          hasDateOfBirth: !!customer.dateOfBirth,
          hasAddress: !!customer.address,
          hasDocuments: hasCompleteDocuments,
          documentCount: [
            customer.driverLicenseNumber,
            customer.passportNumber,
            customer.cinNumber,
          ].filter(Boolean).length,
        }
      );
    } catch (overlayError) {
      console.error("Error in overlay process:", overlayError);
      // Continue processing - don't fail the entire contract
    }
  }

  // Helper function to get nationality from country code
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

  // Helper function to format phone number for contract display
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

  // UPDATED: Validate that customer has required information for contract (simplified)
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

  // UPDATED: Calculate how complete the customer information is (simplified fields)
  calculateCompletionScore(customer) {
    const fields = [
      customer.firstName,
      customer.lastName,
      customer.phone,
      customer.email,
      customer.dateOfBirth,
      customer.address, // Simplified to single address field
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

  // Generate contract with validation
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

  // UPDATED: Get missing customer information for UI display (simplified)
  getMissingCustomerInfo(customer) {
    const allFields = {
      Prénom: customer.firstName,
      Nom: customer.lastName,
      Téléphone: customer.phone,
      Email: customer.email,
      "Date de naissance": customer.dateOfBirth,
      Adresse: customer.address, // Simplified to single field
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

  // UPDATED: Get contract readiness status (simplified)
  getContractReadiness(customer) {
    const missing = this.getMissingCustomerInfo(customer);

    return {
      isReady: missing.hasRequiredFields && missing.hasAnyIdentityDocument,
      completionPercentage: missing.completionPercentage,
      missingCriticalFields: missing.missingFields.filter((field) =>
        ["Prénom", "Nom", "Téléphone"].includes(field)
      ),
      missingDocuments: missing.missingFields.filter(
        (field) =>
          field.includes("permis") ||
          field.includes("passeport") ||
          field.includes("CIN")
      ),
      recommendations: this.getContractRecommendations(customer),
    };
  }

  // NEW: Get recommendations for improving contract completeness
  getContractRecommendations(customer) {
    const recommendations = [];

    if (!customer.dateOfBirth) {
      recommendations.push(
        "Ajouter la date de naissance pour vérification d'âge"
      );
    }

    if (!customer.address) {
      recommendations.push("Ajouter l'adresse complète pour le contrat");
    }

    const hasAnyDoc = !!(
      customer.driverLicenseNumber ||
      customer.passportNumber ||
      customer.cinNumber
    );
    if (!hasAnyDoc) {
      recommendations.push("Ajouter au moins un document d'identité");
    }

    if (!customer.email) {
      recommendations.push(
        "Ajouter l'email pour les notifications (optionnel)"
      );
    }

    return recommendations;
  }
}

module.exports = ContractGenerator;
