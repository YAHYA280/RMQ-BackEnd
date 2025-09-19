// src/services/contractGenerator.js - Enhanced PDF Contract Generation Service
const PDFDocument = require("pdfkit");

class ContractGenerator {
  constructor() {
    this.companyInfo = {
      name: "MELHOR QUE NADA CARS",
      slogan: "Longue & Courte Durée",
      address: "LOCAL 60 RUE 8 ENNASR LOT 635, Tanger - Maroc",
      capital: "100.000.00 dh",
      rc: "003389593000004",
      phone: "06.00.28.08.03 / 07.04.32.87.33",
      email: "melhorquenada@gmail.com",
    };
  }

  async generateContract(bookingData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: "A4",
          info: {
            Title: `Contract ${bookingData.bookingNumber}`,
            Author: this.companyInfo.name,
            Subject: "Car Rental Contract",
            Creator: this.companyInfo.name,
            Producer: this.companyInfo.name,
            CreationDate: new Date(),
          },
        });

        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));

        // Generate contract content
        this.addHeader(doc);
        this.addContractNumber(doc, bookingData.bookingNumber);
        this.addDocumentChecklist(doc);
        this.addParticipantsInfo(doc, bookingData);
        this.addRentalDetails(doc, bookingData);
        this.addConditions(doc);
        this.addSignatures(doc);
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        console.error("PDF generation error:", error);
        reject(error);
      }
    });
  }

  addHeader(doc) {
    // Company header with styling
    doc
      .fontSize(22)
      .fillColor("#1e3a8a")
      .font("Helvetica-Bold")
      .text(this.companyInfo.name, { align: "center" });

    doc
      .fontSize(14)
      .fillColor("#374151")
      .font("Helvetica")
      .text(this.companyInfo.slogan, { align: "center" });

    doc.moveDown(0.5);

    // Contract title with border
    const titleY = doc.y;
    doc
      .rect(40, titleY - 10, doc.page.width - 80, 45)
      .fillAndStroke("#f3f4f6", "#d1d5db");

    doc
      .fillColor("#1f2937")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("CONTRAT DE LOCATION", titleY + 8, { align: "center" });

    doc.moveDown(2);
  }

  addContractNumber(doc, contractNumber) {
    const contractY = doc.y;

    // Contract number box
    doc
      .rect(doc.page.width - 160, contractY, 130, 30)
      .fillAndStroke("#dc2626", "#b91c1c");

    doc
      .fillColor("white")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(`N° ${contractNumber}`, doc.page.width - 145, contractY + 10);

    doc.fillColor("black");
    doc.moveDown(1.5);
  }

  addDocumentChecklist(doc) {
    doc
      .fontSize(12)
      .fillColor("#1f2937")
      .font("Helvetica-Bold")
      .text("Documents de Véhicule", { underline: true });

    const documents = [
      "Carte Grise",
      "Assurance",
      "Vignette",
      "Visite Technique",
      "Autorisation",
      "Contrat",
    ];

    let x = 60;
    const y = doc.y + 10;

    documents.forEach((docName, index) => {
      if (index % 3 === 0 && index > 0) {
        doc.y += 25;
        x = 60;
      }

      // Checkbox
      doc.rect(x, doc.y, 12, 12).stroke("#6b7280");
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#374151")
        .text(docName, x + 18, doc.y + 3);
      x += 120;
    });

    doc.moveDown(2);
  }

  addParticipantsInfo(doc, bookingData) {
    const startY = doc.y;

    // Left column - Renter info
    this.addRenterSection(doc, bookingData.customer, startY);

    // Right column - Vehicle info
    this.addVehicleSection(doc, bookingData.vehicle, bookingData, startY);

    // Move past both columns
    doc.y = Math.max(doc.y, startY + 280);
    doc.moveDown(1);
  }

  addRenterSection(doc, customer, startY) {
    // Renter section header
    doc.rect(40, startY, 260, 30).fillAndStroke("#4f46e5", "#3730a3");

    doc
      .fillColor("white")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("LOCATAIRE", 50, startY + 10);

    doc.fillColor("black").fontSize(10).font("Helvetica");

    const fields = [
      {
        label: "Nom et Prénom",
        value: `${customer.firstName} ${customer.lastName}`,
        arabic: "الإسم واللقب",
      },
      {
        label: "Nationalité",
        value: customer.country || "Marocaine",
        arabic: "الجنسية",
      },
      {
        label: "Date de Naissance",
        value: customer.dateOfBirth
          ? new Date(customer.dateOfBirth).toLocaleDateString("fr-FR")
          : "___________",
        arabic: "تاريخ الازدياد",
      },
      {
        label: "Adresse au Maroc",
        value: customer.address || "___________________________",
        arabic: "عنوان المغرب",
      },
      {
        label: "Permis de conduite N°",
        value: customer.driverLicenseNumber || "_______________",
        arabic: "رقم رخصة السياقة",
      },
      {
        label: "GSM",
        value: customer.phone,
        arabic: "الهاتف النقال",
      },
    ];

    doc.y = startY + 45;

    fields.forEach((field) => {
      const lineY = doc.y;

      // French label
      doc.font("Helvetica").text(`${field.label} :`, 50, lineY, { width: 120 });

      // Arabic label
      doc.font("Helvetica").text(field.arabic, 170, lineY, { width: 80 });

      // Value with underline
      doc
        .font("Helvetica")
        .text(field.value, 50, lineY + 12, { width: 240, underline: true });

      doc.moveDown(1.2);
    });
  }

  addVehicleSection(doc, vehicle, bookingData, startY) {
    // Vehicle info box (right side)
    doc.rect(320, startY, 250, 280).stroke("#d1d5db");

    // Vehicle section header
    doc.rect(320, startY, 250, 30).fillAndStroke("#059669", "#047857");

    doc
      .fillColor("white")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("VÉHICULE & LOCATION", 330, startY + 10);

    const pickupDate = new Date(bookingData.pickupDate).toLocaleDateString(
      "fr-FR"
    );
    const returnDate = new Date(bookingData.returnDate).toLocaleDateString(
      "fr-FR"
    );

    const vehicleFields = [
      {
        label: "Marque/Modèle",
        value: `${vehicle.brand} ${vehicle.name}`,
        arabic: "ماركة السيارة",
      },
      { label: "Année", value: vehicle.year.toString(), arabic: "السنة" },
      {
        label: "Immatriculation",
        value: vehicle.licensePlate,
        arabic: "رقم اللوحة",
      },
      { label: "Date de Départ", value: pickupDate, arabic: "تاريخ المغادرة" },
      {
        label: "Heure de Départ",
        value: bookingData.pickupTime,
        arabic: "ساعة المغادرة",
      },
      { label: "Date de Retour", value: returnDate, arabic: "تاريخ العودة" },
      {
        label: "Heure de Retour",
        value: bookingData.returnTime,
        arabic: "ساعة العودة",
      },
      {
        label: "Nombre de jours",
        value: bookingData.totalDays.toString(),
        arabic: "عدد أيام",
      },
      { label: "Prix/jour", value: `${vehicle.price} DH`, arabic: "السعر/يوم" },
      {
        label: "Montant Total",
        value: `${bookingData.totalAmount} DH`,
        arabic: "المبلغ الإجمالي",
      },
      {
        label: "Kilométrage",
        value: vehicle.mileage ? vehicle.mileage.toString() : "0",
        arabic: "الكيلومترات",
      },
    ];

    doc.fontSize(9).fillColor("black");

    let fieldY = startY + 45;

    vehicleFields.forEach((field) => {
      // French label
      doc
        .font("Helvetica-Bold")
        .fillColor("#374151")
        .text(field.label, 325, fieldY, { width: 100 });

      // Value
      doc
        .font("Helvetica")
        .fillColor("black")
        .text(field.value, 430, fieldY, { width: 135 });

      fieldY += 22;
    });
  }

  addRentalDetails(doc, bookingData) {
    doc.addPage();

    // Rental terms header
    doc
      .fontSize(16)
      .fillColor("#1f2937")
      .font("Helvetica-Bold")
      .text("DÉTAILS DE LA LOCATION", { align: "center", underline: true });

    doc.moveDown(1);

    // Location details
    doc.fontSize(11).fillColor("black").font("Helvetica");

    const details = [
      `Lieu de prise en charge: ${bookingData.pickupLocation}`,
      `Lieu de retour: ${bookingData.returnLocation}`,
      `Durée totale: ${bookingData.totalDays} jour(s)`,
      `Tarif journalier: ${bookingData.dailyRate} DH`,
      `Montant total: ${bookingData.totalAmount} DH`,
    ];

    details.forEach((detail) => {
      doc.text(`• ${detail}`, { indent: 20, paragraphGap: 5 });
    });

    doc.moveDown(2);
  }

  addConditions(doc) {
    doc
      .fontSize(14)
      .fillColor("#1f2937")
      .font("Helvetica-Bold")
      .text("CONDITIONS GÉNÉRALES DE LOCATION", {
        align: "center",
        underline: true,
      });

    doc.moveDown(1);

    const conditions = [
      "Le véhicule doit être rendu dans l'état où il a été reçu, propre et avec le même niveau de carburant.",
      "Toute détérioration, dommage ou perte constatée sera facturée au locataire selon barème en vigueur.",
      "Le locataire s'engage à respecter le code de la route marocain et les limitations de vitesse.",
      "En cas d'accident, prévenir immédiatement la société de location et les autorités compétentes.",
      "La caution sera restituée après vérification de l'état du véhicule et règlement des éventuels frais.",
      "Il est strictement interdit de sous-louer le véhicule à une tierce personne.",
      "Retard de restitution: 50 DH par heure de retard, au-delà de 6h = 1 journée supplémentaire.",
      "Le carburant est à la charge du locataire. Le véhicule doit être rendu avec le même niveau.",
      "Franchise d'assurance: 3000 DH en cas de sinistre responsable du locataire.",
      "Le locataire déclare avoir pris connaissance et accepte toutes ces conditions.",
    ];

    doc.fontSize(10).fillColor("black").font("Helvetica");

    conditions.forEach((condition, index) => {
      doc.text(`${index + 1}. ${condition}`, {
        paragraphGap: 8,
        indent: 15,
        width: doc.page.width - 80,
      });
    });

    doc.moveDown(2);
  }

  addSignatures(doc) {
    const signatureY = doc.y + 30;

    // Ensure we don't run off the page
    if (signatureY > doc.page.height - 150) {
      doc.addPage();
      const newSignatureY = 100;
      this.drawSignatureBoxes(doc, newSignatureY);
    } else {
      this.drawSignatureBoxes(doc, signatureY);
    }
  }

  drawSignatureBoxes(doc, signatureY) {
    // Left signature box - Company
    doc.rect(60, signatureY, 200, 100).stroke("#6b7280");

    // Right signature box - Client
    doc.rect(350, signatureY, 200, 100).stroke("#6b7280");

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1f2937")
      .text("Signature Responsable", 70, signatureY - 20)
      .text("Signature du Client", 360, signatureY - 20);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#6b7280")
      .text(this.companyInfo.name, 70, signatureY + 10)
      .text("Date et lieu:", 70, signatureY + 30)
      .text("Date et lieu:", 360, signatureY + 30);

    // Current date
    const currentDate = new Date().toLocaleDateString("fr-FR");
    doc.text(`Le ${currentDate} à Tanger`, 200, signatureY + 110, {
      align: "center",
    });
  }

  addFooter(doc) {
    const footerY = doc.page.height - 60;

    doc
      .fontSize(8)
      .fillColor("#6b7280")
      .font("Helvetica")
      .text(
        `${this.companyInfo.name} Sarl au capital de ${this.companyInfo.capital}`,
        40,
        footerY,
        { align: "center", width: doc.page.width - 80 }
      )
      .text(`${this.companyInfo.address}`, 40, footerY + 12, {
        align: "center",
        width: doc.page.width - 80,
      })
      .text(
        `R.C. : ${this.companyInfo.rc} | GSM : ${this.companyInfo.phone} | E-mail : ${this.companyInfo.email}`,
        40,
        footerY + 24,
        { align: "center", width: doc.page.width - 80 }
      );
  }
}

module.exports = ContractGenerator;
