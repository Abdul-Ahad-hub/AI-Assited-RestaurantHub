import http from 'node:http';
import assert from 'node:assert';
import { handleApiRequest } from '../server/api.ts';
import { getMinNextBid } from '../server/bidding.ts';

async function runVerification() {
  const server = http.createServer(async (req, res) => {
    const handled = await handleApiRequest(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  async function callApi(path: string, options: RequestInit = {}, token = '') {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
    const data = await res.json();
    return { status: res.status, data };
  }

  try {
    console.log('1. Testing Homepage & Restaurant Discovery (Bidding-First Ranking & Role Separation)...');
    const homeRes = await callApi('/api/discovery/home?city=Karachi');
    assert.strictEqual(homeRes.status, 200);
    assert.ok(homeRes.data.topRated.length > 0, 'Should return topRated restaurants');
    assert.ok(homeRes.data.trendingFood.length > 0, 'Should return trendingFood');
    assert.strictEqual(homeRes.data.topRated[0].active_bid_amount, undefined, 'Must not leak bid dollar amounts to customers');
    assert.strictEqual(homeRes.data.biddingOverview, undefined, 'Bidding overview must not be exposed to customers');
    assert.strictEqual(homeRes.data.topRated[0].bid_rank, 1, 'Top ranked restaurant must have rank #1');
    console.log('   ✓ Homepage discovery, 1-per-row rank #1, & strict customer role separation verified');

    console.log('2. Testing Search & Independent Food Discovery...');
    const searchRes = await callApi('/api/restaurants?q=biryani&city=Karachi');
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchRes.data.restaurants.some((r: any) => r.name.includes("Abdul Ahad's Kitchen")));
    const foodRes = await callApi('/api/foods?q=burger');
    assert.strictEqual(foodRes.status, 200);
    assert.ok(foodRes.data.foods.length > 0, 'Should find burger dishes');
    console.log('   ✓ Restaurant search & dish-level food discovery verified');

    console.log('3. Testing AI Customer Discovery...');
    const aiDisc = await callApi('/api/ai/discovery', {
      method: 'POST',
      body: JSON.stringify({ query: 'Find the best biryani nearby', city: 'Karachi' })
    });
    assert.strictEqual(aiDisc.status, 200);
    assert.ok(aiDisc.data.answer && aiDisc.data.restaurants.length > 0);
    console.log('   ✓ AI Customer Discovery verified');

    console.log('4. Testing Logins (Customer, Owner A, Owner B, Admin)...');
    const custLogin = await callApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@restauranthub.com', password: 'Password123!' })
    });
    assert.strictEqual(custLogin.status, 200);
    const custToken = custLogin.data.token;

    const ownerALogin = await callApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@abdulahadkitchen.com', password: 'Password123!' })
    });
    assert.strictEqual(ownerALogin.status, 200);
    const ownerAToken = ownerALogin.data.token;

    const ownerBLogin = await callApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@zaffran.com', password: 'Password123!' })
    });
    assert.strictEqual(ownerBLogin.status, 200);
    const ownerBToken = ownerBLogin.data.token;

    const adminLogin = await callApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@restauranthub.com', password: 'Password123!' })
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.data.token;
    console.log('   ✓ All 4 role sessions authenticated');

    console.log('5. Testing RBAC & Restaurant Tenant Isolation...');
    // Customer trying to access Owner dashboard -> 403
    const custTryOwner = await callApi('/api/owner/restaurants/rest_abdul_ahad/dashboard', {}, custToken);
    assert.strictEqual(custTryOwner.status, 403, 'Customer must be blocked from owner dashboard');

    // Owner B (Zaffran) trying to access Owner A (Abdul Ahad Kitchen) private dashboard -> 403
    const ownerBTryOwnerA = await callApi('/api/owner/restaurants/rest_abdul_ahad/dashboard', {}, ownerBToken);
    assert.strictEqual(ownerBTryOwnerA.status, 403, 'Owner B must be blocked from Owner A tenant data');

    // Owner A accessing own dashboard -> 200
    const ownerADash = await callApi('/api/owner/restaurants/rest_abdul_ahad/dashboard', {}, ownerAToken);
    assert.strictEqual(ownerADash.status, 200);
    console.log('   ✓ RBAC & strict restaurant tenant isolation verified');

    console.log('6. Testing Server-Side Order Price Calculation (Ignoring Client Price Manipulation)...');
    // Seekh Kebab (food_aa_1) costs $12.99 in DB. Let's send fake client price $0.01 and verify server charges real $12.99!
    const orderRes = await callApi(
      '/api/orders',
      {
        method: 'POST',
        body: JSON.stringify({
          restaurantId: 'rest_abdul_ahad',
          items: [{ foodItemId: 'food_aa_1', name: 'Seekh Kebab', quantity: 2, price: 0.01 }],
          address: 'House 42, Street 10, DHA Phase 5, Karachi',
          phone: '+92 345 2223344',
          orderType: 'delivery',
          source: 'web'
        })
      },
      custToken
    );
    assert.strictEqual(orderRes.status, 201);
    assert.strictEqual(orderRes.data.order.subtotal, 25.98, 'Server must compute 2 * $12.99 = $25.98');
    console.log('   ✓ Server-side order price calculation & anti-tampering verified');

    console.log('7. Testing AI Menu Drafting & Owner Confirmation Flow...');
    const draftRes = await callApi(
      '/api/owner/restaurants/rest_abdul_ahad/ai-menu-draft',
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Add a Tandoori Platter section. Chicken Malai Tikka costs 13.50 and Reshmi Kebab costs 14.00.'
        })
      },
      ownerAToken
    );
    assert.strictEqual(draftRes.status, 200);
    assert.ok(draftRes.data.items.length >= 2, 'Should extract at least 2 draft items');
    console.log('   ✓ AI Menu Architect structured draft extraction verified');

    console.log('8. Testing Atomic Paid Ranking & Scaling Bid Steps...');
    assert.strictEqual(getMinNextBid(0), 0.1, 'Opening bid can be just cents');
    assert.strictEqual(getMinNextBid(0.1), 0.11, 'Tiny bids rise by a cent');
    assert.strictEqual(getMinNextBid(1), 1.05, 'Step grows gradually with the bid');
    assert.strictEqual(getMinNextBid(45), 47.25, 'Larger bids need proportionally larger raises');

    const currentLeading = ownerADash.data.biddingStatus.currentLeadingBid;
    const minNext = ownerADash.data.biddingStatus.minNextEligibleBid;
    assert.strictEqual(minNext, getMinNextBid(currentLeading), 'Next eligible bid must follow the scaling rule');

    // Bidding is for restaurants only: anonymous and customer requests must be rejected
    const anonBid = await callApi('/api/bidding/public-bid', {
      method: 'POST',
      body: JSON.stringify({ restaurantId: 'rest_zaffran', amount: minNext })
    });
    assert.strictEqual(anonBid.status, 401, 'Anonymous users cannot bid');
    const custBid = await callApi(
      '/api/bidding/public-bid',
      { method: 'POST', body: JSON.stringify({ restaurantId: 'rest_zaffran', amount: minNext }) },
      custToken
    );
    assert.strictEqual(custBid.status, 403, 'Customers cannot bid');

    // Try placing an invalid bid (one cent above the leader, below the required step) -> must fail with 400
    const lowBid = await callApi(
      '/api/owner/restaurants/rest_zaffran/bids',
      {
        method: 'POST',
        body: JSON.stringify({ amount: currentLeading + 0.01, notes: 'Too low increment test' })
      },
      ownerBToken
    );
    assert.strictEqual(lowBid.status, 400, 'Bid below the required step must be rejected');

    // Place valid qualifying bid -> must succeed with 201
    const validBid = await callApi(
      '/api/owner/restaurants/rest_zaffran/bids',
      {
        method: 'POST',
        body: JSON.stringify({ amount: minNext, notes: 'Qualifying Bid' })
      },
      ownerBToken
    );
    assert.strictEqual(validBid.status, 201);
    console.log('   ✓ Atomic bidding, scaling steps & restaurant only access verified');

    console.log('9. Testing Admin Console Overview...');
    const adminRes = await callApi('/api/admin/overview', {}, adminToken);
    assert.strictEqual(adminRes.status, 200);
    assert.ok(adminRes.data.users.length >= 6);
    assert.ok(adminRes.data.restaurants.length >= 8);
    console.log('   ✓ Admin Console overview & governance endpoints verified');

    console.log('\nALL 9 END-TO-END WORKFLOW SUITES PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
