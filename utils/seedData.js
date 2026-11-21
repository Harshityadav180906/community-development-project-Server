const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');
const FoodListing = require('../models/FoodListing');
const Ticket = require('../models/Ticket');

dotenv.config();

const seedDatabase = async (clearExisting = true) => {
  try {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bhojansetu';
      await mongoose.connect(mongoUri);
      console.log('[Seed] Connected to MongoDB...');
    }

    if (clearExisting) {
      await User.deleteMany({});
      await FoodListing.deleteMany({});
      await Ticket.deleteMany({});
      console.log('[Seed] Cleared existing users, food listings, and tickets.');
    }

    // Password hash for demo users
    const salt = await bcrypt.genSalt(10);
    const demoHashedPassword = await bcrypt.hash('Password123!', salt);

    // 1. Create Donors
    const donors = await User.create([
      {
        name: 'Chef Rajesh Verma',
        email: 'donor@tajkitchen.com',
        password: demoHashedPassword,
        organizationName: 'The Grand Heritage Banquets',
        role: 'donor',
        phone: '+91 98765 43210',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        currentLocation: {
          latitude: 12.9784,
          longitude: 77.6408,
          address: '42, 100ft Road, Indiranagar',
        },
      },
      {
        name: 'Ananya Deshmukh',
        email: 'events@greenpalace.org',
        password: demoHashedPassword,
        organizationName: 'Green Palace Conventions',
        role: 'donor',
        phone: '+91 98234 56789',
        locality: 'Koramangala',
        city: 'Bengaluru',
        currentLocation: {
          latitude: 12.9352,
          longitude: 77.6245,
          address: '80ft Road, Koramangala 4th Block',
        },
      },
      {
        name: 'Suresh Menon',
        email: 'hostel@apexedu.in',
        password: demoHashedPassword,
        organizationName: 'Apex University Central Mess',
        role: 'donor',
        phone: '+91 97123 45678',
        locality: 'Whitefield',
        city: 'Bengaluru',
        currentLocation: {
          latitude: 12.9698,
          longitude: 77.7500,
          address: 'ITPL Main Road, Whitefield',
        },
      },
    ]);

    // 2. Create NGOs
    const ngos = await User.create([
      {
        name: 'Priya Nair',
        email: 'ngo@feedingindia.org',
        password: demoHashedPassword,
        organizationName: 'Robin Hood Army - Bengaluru Chapter',
        role: 'ngo',
        phone: '+91 99887 76655',
        locality: 'HSR Layout',
        city: 'Bengaluru',
        currentLocation: {
          latitude: 12.9121,
          longitude: 77.6446,
          address: 'Sector 2 Community Center, HSR Layout',
        },
      },
      {
        name: 'Vikram Joshi',
        email: 'care@annaseva.org',
        password: demoHashedPassword,
        organizationName: 'Anna Seva Foundation',
        role: 'ngo',
        phone: '+91 99112 23344',
        locality: 'Jayanagar',
        city: 'Bengaluru',
        currentLocation: {
          latitude: 12.9308,
          longitude: 77.5838,
          address: '4th Block Shelter Home, Jayanagar',
        },
      },
    ]);

    // 3. Create Delivery Partners
    const deliveryPartners = await User.create([
      {
        name: 'Ramesh Kumar',
        email: 'driver@bhojansetu.org',
        password: demoHashedPassword,
        organizationName: 'BhojanSetu Rapid Green Fleet',
        role: 'delivery',
        phone: '+91 98450 11223',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        vehicleType: 'Two-Wheeler / Bike',
        vehicleNumber: 'KA-01-AB-1234',
        isAvailable: true,
        activeOrdersCount: 1,
        walletBalance: 45,
        totalEarnings: 45,
        completedDeliveriesCount: 3,
        currentLocation: {
          latitude: 12.9750,
          longitude: 77.6350,
          address: 'Near Indiranagar Metro Station',
          updatedAt: new Date(),
        },
      },
      {
        name: 'Sunil Reddy',
        email: 'express@bhojansetu.org',
        password: demoHashedPassword,
        organizationName: 'Eco Van Logistics Volunteer',
        role: 'delivery',
        phone: '+91 98451 99887',
        locality: 'Koramangala',
        city: 'Bengaluru',
        vehicleType: 'Eco Delivery Van',
        vehicleNumber: 'KA-03-CD-5678',
        isAvailable: true,
        activeOrdersCount: 0,
        walletBalance: 15,
        totalEarnings: 15,
        completedDeliveriesCount: 1,
        currentLocation: {
          latitude: 12.9300,
          longitude: 77.6200,
          address: 'Near Sony World Junction, Koramangala',
          updatedAt: new Date(),
        },
      },
    ]);

    // 4. Create Super Admin / Company Team Member
    const admin = await User.create({
      name: 'Harshit Yadav (Super Admin)',
      email: 'admin@bhojansetu.org',
      password: demoHashedPassword,
      organizationName: 'BhojanSetu Central Operations HQ',
      role: 'admin',
      phone: '+91 90000 11111',
      locality: 'Central Operations Command, MG Road',
      city: 'Bengaluru',
      currentLocation: {
        latitude: 12.9756,
        longitude: 77.6066,
        address: 'BhojanSetu Central Tower, MG Road',
      },
    });

    console.log(
      `[Seed] Created ${donors.length} donors, ${ngos.length} NGOs, ${deliveryPartners.length} delivery partners, and 1 Super Admin.`
    );

    const now = new Date();
    const hoursFromNow = (hrs) => new Date(now.getTime() + hrs * 60 * 60 * 1000);
    const hoursAgo = (hrs) => new Date(now.getTime() - hrs * 60 * 60 * 1000);

    // 4. Create Food Listings with Coordinates & Assigned Delivery Partners
    const listings = [
      {
        donor: donors[0]._id,
        title: 'Dal Makhani, Shahi Paneer & 90 Butter Tawa Rotis',
        foodType: 'Veg',
        quantityServings: 90,
        cookedAt: hoursAgo(2),
        expiresAt: hoursFromNow(5),
        pickupAddress: '42, 100ft Road, Near Metro Pillar 84, Indiranagar',
        locality: 'Indiranagar',
        contactPhone: '+91 98765 43210',
        notes: 'Fresh dinner buffet overflow. Packed hygienically in stainless steel insulated dispensers. Containers provided.',
        status: 'Available',
        claimedBy: null,
        pickupCoordinates: { latitude: 12.9784, longitude: 77.6408 },
        assignedDriver: null,
        driverStatus: 'Unassigned',
        deliveryOtp: '6154',
        payoutAmount: 15,
      },
      {
        donor: donors[1]._id,
        title: 'Vegetable Dum Biryani & Cucumber Mint Raita',
        foodType: 'Veg',
        quantityServings: 140,
        cookedAt: hoursAgo(1.5),
        expiresAt: hoursFromNow(4.5),
        pickupAddress: 'Hall 3, Green Palace Convention Center, 80 Feet Road, Koramangala',
        locality: 'Koramangala',
        contactPhone: '+91 98234 56789',
        notes: 'Corporate symposium lunch surplus. High quality basmati rice and vegetables. Please bring clean transport crates.',
        status: 'Available',
        claimedBy: null,
        pickupCoordinates: { latitude: 12.9352, longitude: 77.6245 },
        assignedDriver: null,
        driverStatus: 'Unassigned',
        deliveryOtp: '9482',
        payoutAmount: 15,
      },
      {
        donor: donors[2]._id,
        title: 'Homestyle Chicken Curry with Steamed Jeera Rice',
        foodType: 'Non-Veg',
        quantityServings: 75,
        cookedAt: hoursAgo(1),
        expiresAt: hoursFromNow(3.5),
        pickupAddress: 'Block D Loading Bay, Apex University Campus, ITPL Main Road, Whitefield',
        locality: 'Whitefield',
        contactPhone: '+91 97123 45678',
        notes: 'Hostel special dinner surplus. Freshly prepared, temperature monitored at 68C.',
        status: 'Available',
        claimedBy: null,
        pickupCoordinates: { latitude: 12.9698, longitude: 77.7500 },
        assignedDriver: null,
        driverStatus: 'Unassigned',
        deliveryOtp: '3819',
        payoutAmount: 15,
      },
      {
        donor: donors[0]._id,
        title: 'Assorted Club Sandwiches & Fresh Seasonal Cut Fruit',
        foodType: 'Veg',
        quantityServings: 50,
        cookedAt: hoursAgo(2),
        expiresAt: hoursFromNow(6),
        pickupAddress: '42, 100ft Road, Indiranagar',
        locality: 'Indiranagar',
        contactPhone: '+91 98765 43210',
        notes: 'Individually wrapped paper boxes, perfect for immediate distribution to night shelters.',
        status: 'Available',
        claimedBy: null,
        pickupCoordinates: { latitude: 12.9784, longitude: 77.6408 },
        assignedDriver: null,
        driverStatus: 'Unassigned',
        deliveryOtp: '5267',
        payoutAmount: 15,
      },
      {
        donor: donors[1]._id,
        title: 'Mughlai Mutton Biryani & Mirchi Ka Salan',
        foodType: 'Non-Veg',
        quantityServings: 110,
        cookedAt: hoursAgo(3),
        expiresAt: hoursFromNow(2.5),
        pickupAddress: 'Loading Dock B, Green Palace, Koramangala',
        locality: 'Koramangala',
        contactPhone: '+91 98234 56789',
        notes: 'Wedding reception dinner surplus. Claimed by Robin Hood Army volunteer unit.',
        status: 'Claimed',
        claimedBy: ngos[0]._id,
        pickupCoordinates: { latitude: 12.9352, longitude: 77.6245 },
        deliveryCoordinates: {
          latitude: 12.9121,
          longitude: 77.6446,
          address: 'Sector 2 Community Center, HSR Layout, Bengaluru',
        },
        assignedDriver: deliveryPartners[0]._id,
        driverStatus: 'Heading to Pickup',
        deliveryOtp: '7832',
        otpVerified: false,
        smsDispatch: {
          sent: true,
          phone: '+91 99887 76655',
          message: '[BhojanSetu Alert] Your Food Handover OTP for order "Mughlai Mutton Biryani & Mirchi Ka Salan" is 7832. Please provide this 4-digit code to the delivery rider upon arrival.',
          sentAt: hoursAgo(0.4),
          status: 'Delivered',
        },
        paymentStatus: 'Pending',
        payoutAmount: 15,
        driverAssignedAt: hoursAgo(0.5),
      },
      {
        donor: donors[2]._id,
        title: 'Nutritious South Indian Sambar, Steamed Rice & Cabbage Poriyal',
        foodType: 'Veg',
        quantityServings: 180,
        cookedAt: hoursAgo(8),
        expiresAt: hoursFromNow(1),
        pickupAddress: 'Mess Building, Apex University, Whitefield',
        locality: 'Whitefield',
        contactPhone: '+91 97123 45678',
        notes: 'Picked up by Anna Seva Foundation and delivered to Community Shelter #4.',
        status: 'Completed',
        claimedBy: ngos[1]._id,
        pickupCoordinates: { latitude: 12.9698, longitude: 77.7500 },
        deliveryCoordinates: {
          latitude: 12.9308,
          longitude: 77.5838,
          address: '4th Block Shelter Home, Jayanagar, Bengaluru',
        },
        assignedDriver: deliveryPartners[1]._id,
        driverStatus: 'Delivered',
        deliveryOtp: '4532',
        otpVerified: true,
        otpVerifiedAt: hoursAgo(4.2),
        smsDispatch: {
          sent: true,
          phone: '+91 98888 77777',
          message: '[BhojanSetu Alert] Your Food Handover OTP for order "Nutritious South Indian Sambar" is 4532. Please provide this 4-digit code to the delivery rider upon arrival.',
          sentAt: hoursAgo(5.9),
          status: 'Delivered',
        },
        paymentStatus: 'Paid_UPI',
        paymentMethod: 'UPI',
        payoutAmount: 15,
        paymentCompletedAt: hoursAgo(4.1),
        deliveryProofPhoto: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        deliveryProofPhotoUploadedAt: hoursAgo(4.0),
        driverAssignedAt: hoursAgo(6),
        pickedUpAt: hoursAgo(5),
        deliveredAt: hoursAgo(4),
      },
    ];

    const createdListings = await FoodListing.insertMany(listings);
    console.log(`[Seed] Seeded ${createdListings.length} sample surplus food listings with GPS coordinates.`);

    // 5. Seed Support Tickets for Super Admin / Company Team Member
    const tickets = [
      {
        ticketId: 'TKT-1001',
        title: 'Driver landmark assistance needed near Loading Dock B',
        description: 'Rider Ramesh requested gate pass verification to enter Green Palace service alley for biryani pickup.',
        category: 'Address & Navigation',
        priority: 'Medium',
        status: 'Resolved',
        relatedOrder: createdListings[4]._id,
        createdBy: deliveryPartners[0]._id,
        assignedTo: admin._id,
        resolutionNotes: 'Gate pass authorized via security call with donor Chef Rajesh. Rider entered without delay.',
        resolvedAt: hoursAgo(1),
      },
      {
        ticketId: 'TKT-1002',
        title: 'Handover OTP automated dispatch confirmation for Anna Seva',
        description: 'NGO coordinator verified SMS delivery of OTP 4532 on recipient volunteer phone +91 99112 23344.',
        category: 'OTP Verification',
        priority: 'Low',
        status: 'Closed',
        relatedOrder: createdListings[5]._id,
        createdBy: ngos[1]._id,
        assignedTo: admin._id,
        resolutionNotes: 'OTP matched successfully and verified by rider Sunil Reddy upon arrival.',
        resolvedAt: hoursAgo(3.8),
      },
      {
        ticketId: 'TKT-1003',
        title: 'Instant ₹15 delivery fee credit inquiry for Rider Ramesh',
        description: 'Automated verification check that ₹15 was queued for UPI settlement once food photo proof is captured.',
        category: 'Payment & Payout',
        priority: 'High',
        status: 'Open',
        relatedOrder: createdListings[4]._id,
        createdBy: deliveryPartners[0]._id,
        assignedTo: null,
      },
    ];

    await Ticket.insertMany(tickets);
    console.log(`[Seed] Seeded ${tickets.length} operational company support tickets.`);

    return {
      donorsCount: donors.length,
      ngosCount: ngos.length,
      deliveryCount: deliveryPartners.length,
      listingsCount: createdListings.length,
      ticketsCount: tickets.length,
    };
  } catch (error) {
    console.error('[Seed Error]:', error);
    throw error;
  }
};

if (require.main === module) {
  seedDatabase(true)
    .then(() => {
      console.log('\n======================================================');
      console.log('✅ BhojanSetu Database successfully seeded!');
      console.log('------------------------------------------------------');
      console.log('Demo Credentials for Instant Testing:');
      console.log('  👨‍🍳 Donor: donor@tajkitchen.com (Password123!)');
      console.log('  🤝 NGO: ngo@feedingindia.org (Password123!)');
      console.log('  🚚 Delivery: driver@bhojansetu.org (Password123!)');
      console.log('  👑 Admin / Company Team: admin@bhojansetu.org (Password123!)');
      console.log('======================================================\n');
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { seedDatabase };
