import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {LineChart, AreaChart, PieChart} from 'react-native-chart-kit';
import {useQuery} from 'react-query';

import {apiService} from '@services/ApiService';
import {useAuth} from '@services/AuthService';
import {Analytics} from '@types/index';
import {showToast} from '@utils/toast';

const screenWidth = Dimensions.get('window').width;

const DashboardScreen: React.FC = () => {
  const {user} = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard data
  const {
    data: analytics,
    isLoading,
    refetch,
  } = useQuery<Analytics>('dashboard-analytics', async () => {
    const response = await apiService.get<Analytics>('/analytics/dashboard');
    if (response.success) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to fetch analytics');
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      showToast('error', 'Refresh Failed', 'Failed to refresh dashboard data');
    } finally {
      setRefreshing(false);
    }
  };

  const chartConfig = {
    backgroundColor: '#3B82F6',
    backgroundGradientFrom: '#3B82F6',
    backgroundGradientTo: '#1D4ED8',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#FFFFFF',
    },
  };

  if (isLoading && !analytics) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="loading" size={32} color="#3B82F6" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.userName}>{user?.firstName || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Icon name="bell-outline" size={24} color="#6B7280" />
          <View style={styles.notificationBadge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="file-document-multiple" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{analytics?.overview.totalProposals || 0}</Text>
          <Text style={styles.statLabel}>Total Proposals</Text>
        </View>
        
        <View style={styles.statCard}>
          <Icon name="check-circle" size={24} color="#10B981" />
          <Text style={styles.statValue}>{analytics?.overview.acceptedProposals || 0}</Text>
          <Text style={styles.statLabel}>Accepted</Text>
        </View>
        
        <View style={styles.statCard}>
          <Icon name="clock-outline" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{analytics?.overview.pendingProposals || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        
        <View style={styles.statCard}>
          <Icon name="currency-usd" size={24} color="#8B5CF6" />
          <Text style={styles.statValue}>
            ${(analytics?.overview.totalRevenue || 0).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
      </View>

      {/* Conversion Rate */}
      <View style={styles.conversionContainer}>
        <View style={styles.conversionCard}>
          <Text style={styles.conversionRate}>
            {(analytics?.overview.conversionRate || 0).toFixed(1)}%
          </Text>
          <Text style={styles.conversionLabel}>Conversion Rate</Text>
        </View>
        <View style={styles.averageValueCard}>
          <Text style={styles.averageValue}>
            ${(analytics?.overview.averageProposalValue || 0).toLocaleString()}
          </Text>
          <Text style={styles.averageLabel}>Avg. Proposal Value</Text>
        </View>
      </View>

      {/* Proposals Over Time Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Proposals Over Time</Text>
        {analytics?.trends.proposalsOverTime && analytics.trends.proposalsOverTime.length > 0 ? (
          <LineChart
            data={{
              labels: analytics.trends.proposalsOverTime.slice(-6).map(item => 
                new Date(item.date).toLocaleDateString('en-US', { month: 'short' })
              ),
              datasets: [{
                data: analytics.trends.proposalsOverTime.slice(-6).map(item => item.value),
              }],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        ) : (
          <View style={styles.noDataContainer}>
            <Icon name="chart-line" size={48} color="#D1D5DB" />
            <Text style={styles.noDataText}>No data available</Text>
          </View>
        )}
      </View>

      {/* Revenue Trend */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Revenue Trend</Text>
        {analytics?.trends.revenueOverTime && analytics.trends.revenueOverTime.length > 0 ? (
          <AreaChart
            data={{
              labels: analytics.trends.revenueOverTime.slice(-6).map(item => 
                new Date(item.date).toLocaleDateString('en-US', { month: 'short' })
              ),
              datasets: [{
                data: analytics.trends.revenueOverTime.slice(-6).map(item => item.value),
              }],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
          />
        ) : (
          <View style={styles.noDataContainer}>
            <Icon name="currency-usd" size={48} color="#D1D5DB" />
            <Text style={styles.noDataText}>No revenue data</Text>
          </View>
        )}
      </View>

      {/* Proposal Status Distribution */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Proposal Status Distribution</Text>
        {analytics?.performance.proposalStatusDistribution && 
         analytics.performance.proposalStatusDistribution.length > 0 ? (
          <PieChart
            data={analytics.performance.proposalStatusDistribution.map((item, index) => ({
              name: item.status,
              population: item.count,
              color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5],
              legendFontColor: '#374151',
              legendFontSize: 14,
            }))}
            width={screenWidth - 48}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            style={styles.chart}
          />
        ) : (
          <View style={styles.noDataContainer}>
            <Icon name="chart-pie" size={48} color="#D1D5DB" />
            <Text style={styles.noDataText}>No status data</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="plus-circle" size={32} color="#3B82F6" />
            <Text style={styles.actionText}>New Proposal</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="account-plus" size={32} color="#10B981" />
            <Text style={styles.actionText}>Add Client</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="chart-line" size={32} color="#F59E0B" />
            <Text style={styles.actionText}>View Analytics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="cog" size={32} color="#8B5CF6" />
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 16,
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: (screenWidth - 48) / 2,
    marginHorizontal: 4,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  conversionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  conversionCard: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  conversionRate: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  conversionLabel: {
    fontSize: 14,
    color: '#E5E7EB',
    marginTop: 4,
  },
  averageValueCard: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  averageValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  averageLabel: {
    fontSize: 14,
    color: '#D1FAE5',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 24,
    marginTop: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  actionsContainer: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: (screenWidth - 64) / 2,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 32,
  },
});

export default DashboardScreen;