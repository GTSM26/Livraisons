import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DeliveryData } from '../data';

export const generateBCD = (tourNo: string, items: DeliveryData[], bcdNumber: string) => {
  const doc = new jsPDF();
  const firstItem = items[0];
  
  // Format numbers with space as thousands separator
  const formatAmount = (val: number) => {
    return val.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  // Date d'opération = Date de Sortie
  const dateSortieString = firstItem?.dateSortie || "/";
  const dateOperation = dateSortieString !== "/" ? dateSortieString : (firstItem?.dateDepotage || new Date().toLocaleDateString());
  
  // Header Image with Async handling to prevent "Logo non trouvé"
  // Local header image from public/Images folder
  const logoUrl = '/Images/Entête GTSM.png';
  
  // Pre-load the image to avoid the "Error" during PDF generation
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      try {
        const dataURL = canvas.toDataURL("image/png");
        finalizePdf(dataURL);
      } catch (e) {
        finalizePdf();
      }
    } else {
      finalizePdf();
    }
  };
  img.onerror = () => {
    // If external URL fails, try local or fallback
    const localImg = new Image();
    localImg.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = localImg.width;
      canvas.height = localImg.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(localImg, 0, 0);
        try {
          finalizePdf(canvas.toDataURL("image/png"));
        } catch (e) {
          finalizePdf();
        }
      } else {
        finalizePdf();
      }
    };
    localImg.onerror = () => finalizePdf();
    localImg.src = '/Images/Entête GTSM.png';
  };
  img.src = logoUrl;

  const finalizePdf = (logoData?: string) => {
    const drawFooter = (pageNumber: number) => {
      const footerY = 270;
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      
      const legalText = [
        "Pour les prestations exonérées liées aux opérations de transport international. Prévu par l'article 92 (I-35°) du code général des impôts",
        "GTSM Maroc s'engage à verser la TVA exigible au cas où les prestations exonérées ne recevraient pas la destination qui justifie l'exonération.",
        "Merci d'établir une facture par bon de commande"
      ];
      legalText.forEach((line, i) => doc.text(line, 20, footerY + (i * 3)));
      
      const addressLine = '21 Angle Bd Hadj Mekouar et Passage La Plage Bureau N° 12 3éme ETG Ain Sebaâ, Casablanca';
      const contactLine = 'Tél.: +(212) 05 22 67 22 12/13  -  Fax: +(212) 05 22 67 22 14  -  GSM: +(212) 06 61 70 06 49';
      const identifierLine = 'R.C N°: 212369 - Patente N°: 31501688 - I.F N°: 40144275 - CNSS N°: 8302375 - ICE N°: 001511159000011';
      
      doc.setTextColor(51, 65, 85);
      doc.text(addressLine, 105, 282, { align: 'center' });
      doc.text(contactLine, 105, 286, { align: 'center' });
      doc.text(identifierLine, 105, 290, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${pageNumber}`, 190, 290, { align: 'right' });
    };

    const drawHeaderShort = () => {
      doc.setFontSize(10);
      doc.setTextColor(91, 111, 181);
      doc.setFont('helvetica', 'bold');
      doc.text('GTSM Groupe GONDRAND', 20, 15);
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text(bcdNumber, 130, 15);
      doc.line(20, 18, 195, 18);
    };

    if (logoData) {
      doc.addImage(logoData, 'PNG', 15, 10, 180, 30);
    } else {
      // Fallback: simple text header
      doc.setFontSize(20);
      doc.setTextColor(91, 111, 181);
      doc.setFont('helvetica', 'bold');
      doc.text('GTSM', 20, 22);
      doc.setFontSize(12);
      doc.text('Groupe GONDRAND', 20, 28);
    }

    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text(bcdNumber, 20, 48);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date d'opération : ${dateOperation}`, 130, 48);
    
    // Information Sections
    const drawSectionHeader = (title: string, y: number) => {
      doc.setFillColor(219, 234, 254);
      doc.rect(20, y, 170, 7, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text(title, 105, y + 5, { align: 'center' });
    };
    
    drawSectionHeader('INFORMATIONS TRANSPORTEUR', 55);
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Fournisseur :', 30, 70);
    doc.setFont('helvetica', 'bold');
    doc.text(firstItem?.transporteur || '—', 80, 70);
    
    drawSectionHeader('INFORMATIONS CLIENT', 78);
    doc.setFont('helvetica', 'normal');
    doc.text('Client / Destination :', 30, 93);
    doc.setFont('helvetica', 'bold');
    doc.text(firstItem?.zone || 'TANGER / GTSM', 80, 93);
    
    drawSectionHeader("DÉTAILS DE L'EXPÉDITION", 101);
    
    const tableData = items.map(item => [
      `${item.expediteur} / ${item.destinataire}\nRef: ${item.voyage} Pos: ${item.position}`,
      item.nbreColis,
      formatAmount(item.poids),
      formatAmount(item.mpl)
    ]);
    
    autoTable(doc, {
      startY: 108,
      head: [['Désignation', 'Quantité', 'Poids (kg)', 'MPL']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [59, 130, 246], 
        textColor: 255, 
        halign: 'center',
        fontSize: 9,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 25 }
      },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      margin: { left: 20, right: 20, top: 25, bottom: 45 },
      didDrawPage: (data) => {
        drawFooter(data.pageNumber);
        if (data.pageNumber > 1) {
          drawHeaderShort();
        }
      }
    });
    
    let currentY = (doc as any).lastAutoTable.finalY + 5;
    
    const ensureSpace = (spaceNeeded: number) => {
      if (currentY + spaceNeeded > 260) {
        doc.addPage();
        currentY = 25; // Start after short header margin
        drawHeaderShort();
        drawFooter((doc as any).internal.getNumberOfPages());
      }
    };

    const totalColis = items.reduce((sum, item) => sum + item.nbreColis, 0);
    const totalMPL = items.reduce((sum, item) => sum + item.mpl, 0);
    
    ensureSpace(15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(`TOTAL COLIS: ${totalColis}`, 125, currentY + 5);
    doc.text(`TOTAL MPL: ${formatAmount(totalMPL)}`, 160, currentY + 5);
    currentY += 10;

    ensureSpace(25);
    drawSectionHeader('ADRESSES', currentY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 58, 138);
    doc.text('Adresse de Départ :', 25, currentY + 12);
    doc.text('Adresse de Livraison :', 25, currentY + 18);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('MEAD GD TRANS TANGER', 80, currentY + 12);
    doc.text(firstItem?.zone || '—', 80, currentY + 18);
    currentY += 25;
    
    ensureSpace(45);
    drawSectionHeader('MONTANT TOTAL', currentY);
    const ht = items.reduce((sum, item) => sum + item.prixHT, 0);
    const tva = ht * 0.1;
    const ttc = ht + tva;
    const rightX = 110;
    const valueX = 190;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 58, 138);
    doc.text('Total Taxable HT (MAD) :', rightX, currentY + 12);
    doc.text('Total TVA (10%) :', rightX, currentY + 17);
    doc.setFont('helvetica', 'bold');
    doc.text('Montant à Payer TTC :', rightX, currentY + 22);
    doc.setTextColor(220, 38, 38);
    doc.text(formatAmount(ht), valueX, currentY + 12, { align: 'right' });
    doc.text(formatAmount(tva), valueX, currentY + 17, { align: 'right' });
    doc.text(formatAmount(ttc), valueX, currentY + 22, { align: 'right' });
    
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(10);
    doc.text('Référence Voyage / Position :', 20, currentY + 32);
    doc.setFontSize(8);
    const refText = items.map(item => `${item.voyage}/${item.position}`).join(' | ');
    doc.text(refText, 20, currentY + 38, { maxWidth: 100 });
    
    doc.save(`${bcdNumber}.pdf`);
  };
};

export const generateExtractionPDF = (
  groupedTours: Record<string, Record<string, Record<string, Record<number, DeliveryData[]>>>>,
  filters: { carrier: string; month: string; startDate: string; endDate: string }
) => {
  const doc = new jsPDF();
  const logoUrl = '/Images/Entête GTSM.png';
  
  // Format numbers with space as thousands separator
  const formatAmount = (val: number) => {
    return val.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };
  
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      try {
        finalizePdf(canvas.toDataURL("image/png"));
      } catch (e) {
        finalizePdf();
      }
    } else {
      finalizePdf();
    }
  };
  img.onerror = () => finalizePdf();
  img.src = logoUrl;

  const finalizePdf = (logoData?: string) => {
    const drawFooter = (pageNumber: number) => {
      const footerY = 285;
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      const addressLine = '21 Angle Bd Hadj Mekouar et Passage La Plage Bureau N° 12 3éme ETG Ain Sebaâ, Casablanca';
      const contactLine = 'Tél.: +(212) 05 22 67 22 12/13  -  ICE N°: 001511159000011';
      doc.text(addressLine, 105, footerY, { align: 'center' });
      doc.text(contactLine, 105, footerY + 4, { align: 'center' });
      doc.text(`Page ${pageNumber}`, 190, footerY + 4, { align: 'right' });
    };

    if (logoData) {
      doc.addImage(logoData, 'PNG', 15, 10, 180, 25);
    }

    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text("ACTIVITE TRANSPORTEUR", 105, 45, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    const filterText = [
      `Transporteur: ${filters.carrier === 'all' ? 'Tous' : filters.carrier}`,
      `Mois: ${filters.month === 'all' ? 'Tous' : filters.month}`,
      filters.startDate || filters.endDate ? `Période: ${filters.startDate || '—'} au ${filters.endDate || '—'}` : ''
    ].filter(Boolean).join('  |  ');
    doc.text(filterText, 105, 52, { align: 'center' });

    // Global Statistics
    let totalWeight = 0;
    let totalCost = 0;
    let totalLots = 0;
    let totalTours = 0;

    Object.values(groupedTours).forEach(carriers => {
      Object.values(carriers).forEach(dates => {
        Object.values(dates).forEach(tours => {
          Object.values(tours).forEach(items => {
            totalTours++;
            totalLots += items.length;
            totalWeight += items.reduce((sum, i) => sum + i.poids, 0);
            totalCost += items.reduce((sum, i) => sum + i.prixHT, 0);
          });
        });
      });
    });

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 60, 180, 20, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("TOURNÉES", 30, 68);
    doc.text("LOTS", 70, 68);
    doc.text("POIDS TOTAL", 110, 68);
    doc.text("COÛT TOTAL HT", 155, 68);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(totalTours.toString(), 30, 75);
    doc.text(totalLots.toString(), 70, 75);
    doc.text(`${formatAmount(totalWeight)} kg`, 110, 75);
    doc.text(`${formatAmount(totalCost)} MAD`, 155, 75);

    let currentY = 90;

    Object.entries(groupedTours).forEach(([type, carriers]) => {
      // Flow Header
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFillColor(30, 58, 138);
      doc.rect(15, currentY, 180, 8, 'F');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`FLUX: ${type.toUpperCase()}`, 20, currentY + 5.5);
      currentY += 12;

      Object.entries(carriers).forEach(([carrierName, dates]) => {
        Object.entries(dates).forEach(([date, tours]) => {
          Object.entries(tours).forEach(([tourNo, items]) => {
            const tourTotalCost = items.reduce((sum, i) => sum + i.prixHT, 0);
            const tourTotalWeight = items.reduce((sum, i) => sum + i.poids, 0);
            const vhc = items[0]?.nVehicule || "—";

            if (currentY > 240) { doc.addPage(); currentY = 20; }
            
            doc.setFontSize(9);
            doc.setTextColor(51, 65, 85);
            doc.setFont('helvetica', 'bold');
            doc.text(`Tournée #${tourNo} - ${date} - ${carrierName} (${vhc})`, 15, currentY);
            doc.setTextColor(220, 38, 38);
            doc.text(`${formatAmount(tourTotalCost)} MAD`, 195, currentY, { align: 'right' });
            currentY += 4;

            autoTable(doc, {
              startY: currentY,
              head: [['Expéditeur / Destinataire', 'Voyage / Pos', 'Poids', 'Prix HT']],
              body: items.map(item => [
                `${item.expediteur}\n→ ${item.destinataire}`,
                `${item.voyage}\n${item.position}`,
                `${formatAmount(item.poids)} kg`,
                `${formatAmount(item.prixHT)} MAD`
              ]),
              theme: 'grid',
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [71, 85, 105] },
              margin: { left: 15, right: 15 },
              didDrawPage: (data) => drawFooter(data.pageNumber)
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
          });
        });
      });
    });

    const filename = `activite_transporteur_${filters.carrier}_${new Date().toISOString().split('T')[0]}.pdf`.replace(/\s+/g, '_').toLowerCase();
    doc.save(filename);
  };
};
